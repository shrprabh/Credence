/*MYSQL WORKBENCH:*/

/* -------------------------------------------------------------

1. Users
------------------------------------------------------------- */
CREATE TABLE users (
id CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
name VARCHAR(255) NOT NULL,
email VARCHAR(320) NOT NULL UNIQUE,
password VARCHAR(255) NOT NULL, -- hashed
dob DATE,
xp INT NOT NULL DEFAULT 0,
created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

/* -------------------------------------------------------------
2. Skills
------------------------------------------------------------- */
CREATE TABLE skills (
id          CHAR(36)  NOT NULL PRIMARY KEY DEFAULT (UUID()),
type        VARCHAR(255) NOT NULL UNIQUE,
description TEXT
) ENGINE=InnoDB;

/* -------------------------------------------------------------
3. User-Skill join  (per-skill XP tracker)
------------------------------------------------------------- */
CREATE TABLE user_skills (
user_id   CHAR(36) NOT NULL,
skill_id  CHAR(36) NOT NULL,
xp_total  INT NOT NULL DEFAULT 0,
PRIMARY KEY (user_id, skill_id),
CONSTRAINT fk_user_skills_user
FOREIGN KEY (user_id)  REFERENCES users(id)  ON DELETE CASCADE,
CONSTRAINT fk_user_skills_skill
FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
) ENGINE=InnoDB;

/* -------------------------------------------------------------
4. YouTube Channels  (optional)
------------------------------------------------------------- */
CREATE TABLE channels (
id         CHAR(36)  NOT NULL PRIMARY KEY DEFAULT (UUID()),
youtube_id VARCHAR(255) NOT NULL UNIQUE,
title      VARCHAR(255)
) ENGINE=InnoDB;

/* -------------------------------------------------------------
5. Videos
------------------------------------------------------------- */
CREATE TABLE videos (
id         CHAR(36)  NOT NULL PRIMARY KEY DEFAULT (UUID()),
youtube_id VARCHAR(255) NOT NULL UNIQUE,
channel_id CHAR(36),
title      VARCHAR(255) NOT NULL,
duration   INT,                 -- seconds
added_by   CHAR(36),
added_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT fk_videos_channel
FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE SET NULL,
CONSTRAINT fk_videos_user
FOREIGN KEY (added_by)   REFERENCES users(id)    ON DELETE SET NULL
) ENGINE=InnoDB;

/* -------------------------------------------------------------
6. Video ↔ Skill  (many-to-many)
------------------------------------------------------------- */
CREATE TABLE video_skills (
video_id  CHAR(36) NOT NULL,
skill_id  CHAR(36) NOT NULL,
PRIMARY KEY (video_id, skill_id),
CONSTRAINT fk_video_skills_video
FOREIGN KEY (video_id) REFERENCES videos(id)  ON DELETE CASCADE,
CONSTRAINT fk_video_skills_skill
FOREIGN KEY (skill_id) REFERENCES skills(id)  ON DELETE CASCADE
) ENGINE=InnoDB;

/* -------------------------------------------------------------
7. Transcripts  (1 : 1 with video)
------------------------------------------------------------- */
CREATE TABLE video_transcripts (
video_id   CHAR(36) NOT NULL PRIMARY KEY,
transcript LONGTEXT NOT NULL,
CONSTRAINT fk_transcripts_video
FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
) ENGINE=InnoDB;

/* -------------------------------------------------------------
8. Quizzes  (one per video)
------------------------------------------------------------- */
CREATE TABLE quizzes (
id         CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
video_id   CHAR(36) NOT NULL UNIQUE,
created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT fk_quizzes_video
FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
) ENGINE=InnoDB;

/* -------------------------------------------------------------
9. Quiz Questions
------------------------------------------------------------- */
CREATE TABLE quiz_questions (
id        CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
quiz_id   CHAR(36) NOT NULL,
question  TEXT NOT NULL,
ordinal   INT  NOT NULL,  -- question order within quiz
UNIQUE (quiz_id, ordinal),
CONSTRAINT fk_questions_quiz
FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
) ENGINE=InnoDB;

/* -------------------------------------------------------------
10. Quiz Choices
------------------------------------------------------------- */
CREATE TABLE quiz_choices (
id          CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
question_id CHAR(36) NOT NULL,
choice_text TEXT NOT NULL,
is_correct  BOOLEAN NOT NULL DEFAULT FALSE,
CONSTRAINT fk_choices_question
FOREIGN KEY (question_id) REFERENCES quiz_questions(id) ON DELETE CASCADE
) ENGINE=InnoDB;

/* -------------------------------------------------------------
11. User Video Progress
------------------------------------------------------------- */
CREATE TABLE user_video_progress (
user_id      CHAR(36) NOT NULL,
video_id     CHAR(36) NOT NULL,
watched_secs INT NOT NULL DEFAULT 0,
completed    BOOLEAN NOT NULL DEFAULT FALSE,
xp_awarded   INT NOT NULL DEFAULT 0,
updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
ON UPDATE CURRENT_TIMESTAMP,
PRIMARY KEY (user_id, video_id),
CONSTRAINT fk_progress_user
FOREIGN KEY (user_id)  REFERENCES users(id)   ON DELETE CASCADE,
CONSTRAINT fk_progress_video
FOREIGN KEY (video_id) REFERENCES videos(id)  ON DELETE CASCADE
) ENGINE=InnoDB;

/* -------------------------------------------------------------
12. Quiz Attempts
------------------------------------------------------------- */
CREATE TABLE quiz_attempts (
id          CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
user_id     CHAR(36) NOT NULL,
quiz_id     CHAR(36) NOT NULL,
score       INT NOT NULL,
xp_awarded  INT NOT NULL DEFAULT 0,
attempted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
UNIQUE (user_id, quiz_id),     -- only one attempt counts for XP
CONSTRAINT fk_attempts_user
FOREIGN KEY (user_id) REFERENCES users(id)   ON DELETE CASCADE,
CONSTRAINT fk_attempts_quiz
FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
) ENGINE=InnoDB;

/* -------------------------------------------------------------
13. NFT Claims
------------------------------------------------------------- */
CREATE TABLE nft_claims (
id          CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
user_id     CHAR(36) NOT NULL,
skill_id    CHAR(36) NOT NULL,
nft_address VARCHAR(255) NOT NULL,  -- on-chain address or tx sig
claimed_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
UNIQUE (user_id, skill_id),
CONSTRAINT fk_claims_user
FOREIGN KEY (user_id)  REFERENCES users(id)  ON DELETE CASCADE,
CONSTRAINT fk_claims_skill
FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
) ENGINE=InnoDB;

Sample Insertion:

/* ============================================================
SAMPLE DATA  – numeric IDs for every table
============================================================ */

/* ---------- 1 ▸ Users ---------- */
INSERT INTO users (id, name, email, password, dob) VALUES
('101', 'Alice Wang',  'alice@example.com', '$2b$12$examplehash', '1995-06-15'),
('102', 'Bob Smith',   'bob@example.com',   '$2b$12$examplehash', '1992-01-30'),
('103', 'Carol Johnson','carol@example.com','$2b$12$examplehash', '1998-11-09');

/* ---------- 2 ▸ Skills ---------- */
INSERT INTO skills (id, type, description) VALUES
('201', 'Python',             'General-purpose programming'),
('202', 'React',              'Frontend framework'),
('203', 'Blockchain',         'Distributed-ledger development'),
('204', 'Data Visualization', 'Charts and dashboards');

/* ---------- 3 ▸ User-Skill (per-skill XP) ---------- */
INSERT INTO user_skills (user_id, skill_id, xp_total) VALUES
('101','201',120), ('101','202', 50),
('102','201', 30), ('102','203', 80),
('103','202', 70), ('103','204',150);

/* ---------- 4 ▸ YouTube Channels ---------- */
INSERT INTO channels (id, youtube_id, title) VALUES
('301','UC_TECH123','TechWorld'),
('302','UC_LEARN456','LearnWithUs');

/* ---------- 5 ▸ Videos ---------- */
INSERT INTO videos (id, youtube_id, channel_id, title, duration, added_by) VALUES
('401','PY123','301','Intro to Python Functions',  900,'101'),
('402','RE456','301','React Hooks Deep Dive',     1200,'102'),
('403','SO789','302','Building DApps on Solana',  1800,'101');

/* ---------- 6 ▸ Video ↔ Skill map ---------- */
INSERT INTO video_skills (video_id, skill_id) VALUES
('401','201'),      -- Python video
('402','202'),      -- React video
('403','203'),      -- Solana/Blockchain video
('403','201');      -- also shows Python concepts

/* ---------- 7 ▸ Video Transcripts ---------- */
INSERT INTO video_transcripts (video_id, transcript) VALUES
('401','Auto-generated transcript for Intro to Python Functions.'),
('402','Auto-generated transcript for React Hooks Deep Dive.'),
('403','Auto-generated transcript for Building DApps on Solana.');

/* ---------- 8 ▸ Quizzes (one per video) ---------- */
INSERT INTO quizzes (id, video_id) VALUES
('501','401'),
('502','402'),
('503','403');

/* ---------- 9 ▸ Quiz Questions ---------- */
INSERT INTO quiz_questions (id, quiz_id, question, ordinal) VALUES
('601','501','Which keyword defines a function in Python?',               1),
('602','502','Which React Hook lets you manage component state?',         1),
('603','503','What runtime do Solana programs execute on?',               1);

/* ---------- 10 ▸ Quiz Choices ---------- */
-- Q1 choices
INSERT INTO quiz_choices (id, question_id, choice_text, is_correct) VALUES
('701','601','def',     TRUE), ('702','601','func',   FALSE),
('703','601','lambda',  FALSE), ('704','601','begin', FALSE);

- - Q2 choices
INSERT INTO quiz_choices (id, question_id, choice_text, is_correct) VALUES
('705','602','useState', TRUE), ('706','602','useEffect', FALSE),
('707','602','useMemo', FALSE), ('708','602','createState', FALSE);
- - Q3 choices
INSERT INTO quiz_choices (id, question_id, choice_text, is_correct) VALUES
('709','603','BPF', TRUE), ('710','603','EVM', FALSE),
('711','603','Wasm', FALSE), ('712','603','JVM', FALSE);

/* ---------- 11 ▸ User-Video Progress ---------- */
INSERT INTO user_video_progress
(user_id, video_id, watched_secs, completed, xp_awarded)
VALUES  ('101','401', 900, TRUE, 120),
('102','402', 600, FALSE, 60),
('103','403',1800, TRUE, 200);

/* ---------- 12 ▸ Quiz Attempts ---------- */
INSERT INTO quiz_attempts (id, user_id, quiz_id, score, xp_awarded) VALUES
('801','101','501',100,50),
('802','102','502', 60,30),
('803','103','503', 80,40);

/* ---------- 13 ▸ NFT Claims ---------- */
INSERT INTO nft_claims (id, user_id, skill_id, nft_address) VALUES
('901','101','201','SOL_ADDRESS_ABC'),
('902','103','203','SOL_ADDRESS_DEF');

/* ======  Done!  Verify with quick SELECTs as needed.  ====== */