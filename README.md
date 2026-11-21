# MediBook: Clinic Appointment System

Backend service for booking doctor appointments at a community clinic. Doctors see patients in fixed 30-minute slots between 09:00 and 17:00, each doctor takes at most 12 appointments a day, and the administrator gets reports.

**Stack:** Node.js, Express, MySQL (`mysql2`, parameterized queries only, no ORM), Redis (`ioredis`), Jest.

The original assignment brief is kept in [docs/ASSIGNMENT.md](docs/ASSIGNMENT.md). The database diagram is [schema-diagram.pdf](schema-diagram.pdf) (dbdiagram.io source: [database/schema.dbml](database/schema.dbml)).

## Prerequisites

- Node.js 18 or newer
- MySQL 8.0.16 or newer (CHECK constraints are only enforced from 8.0.16)
- Redis 6.2 or newer (the queues use `LMOVE` / `BLMOVE`)
- Docker is the easiest way to get both databases

## Setup

1. **Start MySQL and Redis** (PowerShell, from the project root). The first start runs `database/schema.sql` and then `database/seed.sql` automatically:

   ```powershell
   docker run -d --name medibook-mysql -e MYSQL_ROOT_PASSWORD=<your-password> -p 3306:3306 -v "${PWD}/database:/docker-entrypoint-initdb.d" mysql:8.0
   docker run -d --name medibook-redis -p 6379:6379 redis:7
   ```

   Without Docker, load the scripts into your own MySQL instead:

   ```
   mysql -u <user> -p < database/schema.sql
   mysql -u <user> -p < database/seed.sql
   ```

2. **Create your environment file** and fill in `DB_USER` and `DB_PASSWORD`. `.env` is git-ignored; never commit it.

   ```powershell
   Copy-Item .env.example .env
   ```

3. **Install and run**

   ```powershell
   npm install
   npm start
   ```

   In a second terminal, start the worker (waitlist promotion and notification jobs):

   ```powershell
   npm run worker
   ```

4. **Run the tests.** They need neither MySQL nor Redis:

   ```powershell
   npm test
   ```

The API listens on the `PORT` from `.env` (`.env.example` uses 3011). The seed appointments are dated December 2026. Because booking only accepts future dates, the seed data is meant to be used before then.

## Environment variables

See [.env.example](.env.example). Business rules (`MAX_APPOINTMENTS_PER_DAY`, `SLOT_MINUTES`, `WORKDAY_START`, `WORKDAY_END`, `BUSY_DAY_THRESHOLD`) and worker settings are read once in `src/config/index.js`, so each value is defined in one place.

## API

| Method | Path | Purpose | Success |
|---|---|---|---|
| POST, GET | `/api/patients` | Create, list patients | 201, 200 |
| GET, PUT, DELETE | `/api/patients/:id` | Read, update, delete one patient | 200, 200, 204 |
| POST, GET | `/api/doctors` | Create, list doctors | 201, 200 |
| GET, PUT, DELETE | `/api/doctors/:id` | Read, update, delete one doctor | 200, 200, 204 |
| GET | `/api/doctors/:id/statistics` | Revenue, upcoming count, next 7 days, utilization | 200 |
| POST | `/api/appointments` | Book an appointment | 201 |
| GET | `/api/appointments/:id` | Read one appointment | 200 |
| DELETE | `/api/appointments/:id` | Cancel (refund computed by the server) | 200 |
| POST | `/api/waitlist` | Join the waitlist for a full slot or day | 201 |
| GET | `/api/waitlist?doctor_id=1&date=2026-12-07` | Show a doctor-day queue | 200 |
| GET | `/api/reports/doctors` | Every doctor's appointments and revenue | 200 |
| GET | `/api/reports/busy-days` | Doctor-days above 80% of capacity | 200 |
| GET | `/feedback?lang=fr` | Course feedback page (English default) | 200 |

Booking body: `{ "patient_id": 1, "doctor_id": 1, "appt_datetime": "2026-12-20 10:00" }`.

Error codes: `400` malformed input, `404` unknown id, `409` conflict (slot taken, day full, duplicate email, already cancelled, row still referenced), `422` valid input that breaks a business rule (past date, outside hours, off the 30-minute boundary).

Booking a taken slot or a full day returns `409` with `"waitlist_available": true`.

## Design justifications

### Part C: API design and business rules

**Structure.** Routes map URLs to controllers, controllers validate input and shape responses, a service layer holds the booking and cancellation logic, and models hold all SQL. The service layer exists because the worker process needs the same booking logic as the web server when it promotes a waitlisted patient, so the rules cannot live in an Express controller. Every statement uses `?` placeholders through `mysql2`.

**REST choices.** Plural nouns for resources, HTTP verbs for actions, `201` plus a `Location` header on create, `204` on delete. Cancelling is `DELETE /api/appointments/:id` because it is the assignment's "delete" operation, but the row is kept with status `cancelled` for refund history, so the response is `200` with the refund amount rather than an empty `204`.

**No double booking, even under simultaneous requests.** Booking runs in one transaction that first locks the doctor's row (`SELECT ... FOR UPDATE`), then checks the slot, counts that day's live bookings, and inserts. All bookings for the same doctor queue behind the lock, so neither the same-slot race nor the 12-per-day race can happen: two requests can never both read "11 booked" and both insert. As a backstop the database also has `UNIQUE (doctor_id, active_slot)`. `active_slot` is a generated column equal to `appt_datetime` while the status is `booked` and `NULL` once cancelled. MySQL unique indexes ignore NULLs, so a cancelled slot is bookable again while the cancelled row stays for refund history. `npm run demo:concurrency` fires simultaneous requests at a running API to show this.

**Refund policy (computed on the server from the notice given, never taken from the client).**

| Notice before the appointment | Refund |
|---|---|
| more than 48 hours | 100% |
| 24 hours to 48 hours, **both ends inclusive** | 50% |
| less than 24 hours | 0% |

So exactly 48 hours is 50% ("more than 48" is strict) and exactly 24 hours is 50%. A cancellation and its refund fields are written in one `UPDATE` inside a transaction, so they succeed or fail together. The database also has a CHECK that ties `status`, `refund_amount` and `cancelled_at` together and never allows a refund above the amount paid.

**Slots.** Bookings must be in the future, on a 30-minute boundary, between 09:00 and 16:30. A 17:00 start is rejected because that slot would end at 17:30, so 16:30 is the last slot. The pure functions for this and for refunds are in `src/utils` and are unit tested without any database.

**Statistics and reports** are produced by SQL in `src/models/reportModel.js`: `LEFT JOIN` so doctors with no appointments appear with zeros, `GROUP BY ... HAVING` for busy days, and a recursive CTE to generate the 7-day calendar so days without bookings show 0. Revenue collected is the amount paid minus refunds, and only `booked` rows count as appointments.

### Part D: audit log

`src/utils/auditLogger.js` appends one JSON line per event to `logs/audit.log` using `fs.promises` (no `*Sync` calls), after a successful booking, cancellation, waitlist join or promotion, and notification. It creates `logs/` on the first write (`mkdir` with `recursive: true`, cached once it succeeds). Every write is wrapped in `try/catch` and never rethrows, so a logging failure is printed to the console but cannot fail the user's request.

### Part E: queues and Redis

**Waitlist.** If a slot is taken or the doctor's day is full, the API answers `409` with `waitlist_available: true`, and the patient can `POST /api/waitlist`. Entries go into one Redis list per doctor per day. An entry has scope `day` (the whole day was full, so any freed slot will do) or `slot` (only that slot was taken, so it waits for that exact slot). Joining is refused with `422` if the slot is actually free.

**Worker.** Cancelling pushes a promotion job onto a Redis list. `src/worker.js` runs as a separate process (`npm run worker`), takes the job, picks the first eligible waitlisted patient in queue order, and books them through the same service as the web server. A job queued while the worker is off simply waits in Redis.

**A promoted booking that fails does not lose the patient.** Taking a patient off the queue is an atomic move into a `waitlist:processing` list, not a delete. They are removed from it only after the booking succeeds.
- If the slot was taken again or a booking rule failed, they go back to the front of their queue.
- If the patient no longer exists, or fails repeatedly for infrastructure reasons (3 attempts), they are parked in `waitlist:failed` with the reason, and a `WAITLIST_FAILED` line goes to the audit log.
- If the worker dies mid-promotion, the patient is still in `waitlist:processing`; on the next start the worker returns everything there to its queue.
- Jobs follow the same pattern: a failed job is retried a limited number of times and then parked in a `:failed` list.

The guarantee is at-least-once, not exactly-once. If the booking commits but Redis fails before the acknowledgement, a patient could be promoted twice. Closing that gap would need an idempotency key.

**Notifications.** Every confirmed appointment, including promotions, enqueues a confirmation job. The worker writes the message to the audit log as `NOTIFICATION_SENT` (nothing is really sent).

### Part G: i18n and l10n

`GET /feedback` renders five textareas. The page title, instructions and questions come from `locales/en.json` and `locales/fr.json`. `?lang=fr` shows French; a missing or unsupported value (including repeated or malformed `lang` parameters) falls back to English. The date uses `Intl.DateTimeFormat` for the active locale. A new language only needs a new JSON file with the same keys; a test checks that every locale has exactly five questions. The submit button only shows a thank-you message; feedback is not stored.

## Project structure

```
├── database/        schema.sql, seed.sql, schema.dbml
├── locales/         en.json, fr.json
├── scripts/         concurrency-demo.js
├── tests/           Jest unit tests (no MySQL or Redis needed)
└── src/
    ├── config/      environment, MySQL pool, Redis clients
    ├── routes/      URL and HTTP method mapping
    ├── controllers/ input validation, response shaping
    ├── services/    booking, cancellation, waitlist logic (shared with the worker)
    ├── models/      all SQL, parameterized
    ├── queue/       reliable-queue helpers, waitlist keys, job producers
    ├── middleware/  central error handler
    ├── utils/       refund, slot validation, audit logger, i18n, validators
    ├── views/       feedback page HTML
    ├── app.js       Express app
    ├── server.js    web server entry point
    └── worker.js    worker entry point
```

## Known limitations

- The audit log is a plain file on one machine and is not rotated.
- Waitlist promotion is at-least-once (see Part E above).
- The feedback form does not store answers.
- The system has been run with a single worker only. Running several was not tested.
