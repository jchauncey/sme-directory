-- SQLite FTS5 search index for Question and Answer.
-- Question.id and Answer.id are TEXT cuids, so we use a contentless shadow
-- table indexed by an UNINDEXED `id` column rather than FTS5 external content
-- (which requires INTEGER rowids). Triggers keep each shadow in sync.

CREATE VIRTUAL TABLE question_fts USING fts5(
  id UNINDEXED,
  title,
  body,
  tokenize = 'porter unicode61 remove_diacritics 2'
);

CREATE TRIGGER question_fts_ai AFTER INSERT ON "Question" BEGIN
  INSERT INTO question_fts (id, title, body) VALUES (new.id, new.title, new.body);
END;

CREATE TRIGGER question_fts_ad AFTER DELETE ON "Question" BEGIN
  DELETE FROM question_fts WHERE id = old.id;
END;

CREATE TRIGGER question_fts_au AFTER UPDATE ON "Question" BEGIN
  UPDATE question_fts SET title = new.title, body = new.body WHERE id = old.id;
END;

CREATE VIRTUAL TABLE answer_fts USING fts5(
  id UNINDEXED,
  body,
  tokenize = 'porter unicode61 remove_diacritics 2'
);

CREATE TRIGGER answer_fts_ai AFTER INSERT ON "Answer" BEGIN
  INSERT INTO answer_fts (id, body) VALUES (new.id, new.body);
END;

CREATE TRIGGER answer_fts_ad AFTER DELETE ON "Answer" BEGIN
  DELETE FROM answer_fts WHERE id = old.id;
END;

CREATE TRIGGER answer_fts_au AFTER UPDATE ON "Answer" BEGIN
  UPDATE answer_fts SET body = new.body WHERE id = old.id;
END;

-- Backfill any pre-existing rows.
INSERT INTO question_fts (id, title, body)
  SELECT id, title, body FROM "Question";

INSERT INTO answer_fts (id, body)
  SELECT id, body FROM "Answer";
