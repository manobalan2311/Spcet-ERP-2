CREATE TABLE IF NOT EXISTS student_logins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id VARCHAR(64) NOT NULL UNIQUE,
  register_number VARCHAR(32) NOT NULL UNIQUE,
  password_hash CHAR(64) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  last_login_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS professor_logins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  professor_id VARCHAR(64) NOT NULL UNIQUE,
  employee_id VARCHAR(32) NOT NULL UNIQUE,
  password_hash CHAR(64) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  last_login_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Insert demo student login
INSERT INTO student_logins (student_id, register_number, password_hash, is_active)
VALUES (
  'stu_001',
  '22CSE001',
  SHA2('student123', 256),
  1
)
ON DUPLICATE KEY UPDATE
  register_number = VALUES(register_number),
  password_hash = VALUES(password_hash),
  is_active = 1;

-- Insert demo professor login
INSERT INTO professor_logins (professor_id, employee_id, password_hash, is_active)
VALUES (
  'prof_001',
  'PROF001',
  SHA2('professor123', 256),
  1
)
ON DUPLICATE KEY UPDATE
  employee_id = VALUES(employee_id),
  password_hash = VALUES(password_hash),
  is_active = 1;