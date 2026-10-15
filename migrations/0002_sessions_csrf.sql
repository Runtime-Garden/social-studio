-- 0002_sessions_csrf: session-bound CSRF token (blueprint 11).
--
-- Every session row carries the token that mutating browser routes must
-- echo in the `x-csrf-token` header. Existing rows (none in practice at
-- this migration) get an empty token that can never match a request.

ALTER TABLE sessions ADD COLUMN csrf_token TEXT NOT NULL DEFAULT '';
