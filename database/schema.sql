-- MediBook schema (3NF). Run on a fresh MySQL 8.0.16+ server:
--   mysql -u <user> -p < database/schema.sql

DROP DATABASE IF EXISTS medibook;
CREATE DATABASE medibook CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE medibook;

CREATE TABLE patients (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  full_name  VARCHAR(100) NOT NULL,
  email      VARCHAR(150) NOT NULL,
  phone      VARCHAR(20)  NOT NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT uq_patients_email UNIQUE (email)
) ENGINE=InnoDB;

CREATE TABLE doctors (
  id               INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  full_name        VARCHAR(100)  NOT NULL,
  specialty        VARCHAR(80)   NOT NULL,
  consultation_fee DECIMAL(10,2) NOT NULL,
  room             VARCHAR(10)   NOT NULL,
  created_at       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT chk_doctors_fee CHECK (consultation_fee >= 0)
) ENGINE=InnoDB;

CREATE TABLE appointments (
  id             INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  patient_id     INT UNSIGNED  NOT NULL,
  doctor_id      INT UNSIGNED  NOT NULL,
  appt_datetime  DATETIME      NOT NULL,
  status         ENUM('booked','cancelled') NOT NULL DEFAULT 'booked',
  amount_paid    DECIMAL(10,2) NOT NULL,
  refund_amount  DECIMAL(10,2) NULL,
  cancelled_at   DATETIME      NULL,
  booked_on      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- Only live bookings occupy a slot. Cancelled rows get NULL here, and MySQL
  -- unique indexes ignore NULLs, so a cancelled slot is rebookable while the
  -- cancelled row is kept for refund history.
  active_slot    DATETIME GENERATED ALWAYS AS
                   (IF(status = 'booked', appt_datetime, NULL)) STORED,
  PRIMARY KEY (id),
  CONSTRAINT fk_appt_patient FOREIGN KEY (patient_id) REFERENCES patients (id),
  CONSTRAINT fk_appt_doctor  FOREIGN KEY (doctor_id)  REFERENCES doctors (id),
  -- A doctor cannot hold two live appointments at the same date/time.
  CONSTRAINT uq_doctor_active_slot UNIQUE (doctor_id, active_slot),
  -- 30-minute boundary, last slot starts 16:30 so it ends by 17:00.
  CONSTRAINT chk_appt_slot CHECK (
    MINUTE(appt_datetime) IN (0, 30)
    AND SECOND(appt_datetime) = 0
    AND TIME(appt_datetime) BETWEEN '09:00:00' AND '16:30:00'
  ),
  CONSTRAINT chk_appt_amount CHECK (amount_paid >= 0),
  -- Refund fields are set together, only when cancelled, and never exceed payment.
  CONSTRAINT chk_appt_cancellation CHECK (
    (status = 'booked'    AND refund_amount IS NULL AND cancelled_at IS NULL)
    OR
    (status = 'cancelled' AND refund_amount IS NOT NULL AND cancelled_at IS NOT NULL
                          AND refund_amount >= 0 AND refund_amount <= amount_paid)
  ),
  INDEX idx_appt_patient (patient_id),
  INDEX idx_appt_doctor_day (doctor_id, appt_datetime)
) ENGINE=InnoDB;
