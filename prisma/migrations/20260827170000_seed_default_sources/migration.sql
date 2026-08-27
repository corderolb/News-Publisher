-- Seeds the standard set of film/TV news sources so a fresh install (no
-- source rows yet) starts with a usable "Quellen" list instead of empty.
-- Guarded by "WHERE NOT EXISTS (... WHERE name = ...)" so this is a no-op
-- against any database that already has a source with that name (e.g. an
-- existing install re-running migrate deploy, or someone who added the
-- same source manually under a different id).

INSERT INTO "Source" ("id", "name", "url", "type", "category", "maxItemsPerRun", "extractFullArticle", "active", "createdAt", "updatedAt")
SELECT 'seed-hollywood-reporter', 'Hollywood Reporter', 'https://www.hollywoodreporter.com/c/movies/movie-news/feed/', 'RSS', 'Filme und Serien', 20, 1, 1, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE NOT EXISTS (SELECT 1 FROM "Source" WHERE "name" = 'Hollywood Reporter');

INSERT INTO "Source" ("id", "name", "url", "type", "category", "maxItemsPerRun", "extractFullArticle", "active", "createdAt", "updatedAt")
SELECT 'seed-variety', 'Variety', 'https://variety.com/feed/', 'RSS', 'Filme und Serien', 10, 1, 1, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE NOT EXISTS (SELECT 1 FROM "Source" WHERE "name" = 'Variety');

INSERT INTO "Source" ("id", "name", "url", "type", "category", "maxItemsPerRun", "extractFullArticle", "active", "createdAt", "updatedAt")
SELECT 'seed-deadline', 'Deadline', 'https://deadline.com/feed/', 'RSS', 'Filme und Serien', 10, 1, 1, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE NOT EXISTS (SELECT 1 FROM "Source" WHERE "name" = 'Deadline');

INSERT INTO "Source" ("id", "name", "url", "type", "category", "maxItemsPerRun", "extractFullArticle", "active", "createdAt", "updatedAt")
SELECT 'seed-collider', 'Collider', 'https://collider.com/feed/', 'RSS', 'Filme und Serien', 10, 1, 1, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE NOT EXISTS (SELECT 1 FROM "Source" WHERE "name" = 'Collider');

INSERT INTO "Source" ("id", "name", "url", "type", "category", "maxItemsPerRun", "extractFullArticle", "active", "createdAt", "updatedAt")
SELECT 'seed-screen-rant', 'Screen Rant', 'https://screenrant.com/feed/', 'RSS', 'Filme und Serien', 10, 1, 1, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE NOT EXISTS (SELECT 1 FROM "Source" WHERE "name" = 'Screen Rant');

INSERT INTO "Source" ("id", "name", "url", "type", "category", "maxItemsPerRun", "extractFullArticle", "active", "createdAt", "updatedAt")
SELECT 'seed-tmz', 'TMZ', 'https://www.tmz.com/rss.xml', 'RSS', 'Filme und Serien', 10, 1, 1, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE NOT EXISTS (SELECT 1 FROM "Source" WHERE "name" = 'TMZ');

INSERT INTO "Source" ("id", "name", "url", "type", "category", "maxItemsPerRun", "extractFullArticle", "active", "createdAt", "updatedAt")
SELECT 'seed-screen-daily', 'Screen Daily', 'https://www.screendaily.com/45187.rss', 'RSS', 'Filme und Serien', 10, 1, 1, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE NOT EXISTS (SELECT 1 FROM "Source" WHERE "name" = 'Screen Daily');

INSERT INTO "Source" ("id", "name", "url", "type", "category", "maxItemsPerRun", "extractFullArticle", "active", "createdAt", "updatedAt")
SELECT 'seed-ndr-kultur-film', 'NDR Kultur Film', 'https://www.ndr.de/kultur/film/index-rss.xml', 'RSS', 'Filme und Serien', 10, 1, 1, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE NOT EXISTS (SELECT 1 FROM "Source" WHERE "name" = 'NDR Kultur Film');

INSERT INTO "Source" ("id", "name", "url", "type", "category", "maxItemsPerRun", "extractFullArticle", "active", "createdAt", "updatedAt")
SELECT 'seed-moviepilot', 'Moviepilot', 'https://www.moviepilot.de/files/feeds/moviepilot-articles-standard.rss', 'RSS', 'Filme und Serien', 15, 1, 1, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE NOT EXISTS (SELECT 1 FROM "Source" WHERE "name" = 'Moviepilot');

INSERT INTO "Source" ("id", "name", "url", "type", "category", "maxItemsPerRun", "extractFullArticle", "active", "createdAt", "updatedAt")
SELECT 'seed-moviejones', 'Moviejones', 'https://www.moviejones.de/moviejones-feeds.html', 'RSS', 'Filme und Serien', 15, 1, 1, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE NOT EXISTS (SELECT 1 FROM "Source" WHERE "name" = 'Moviejones');

INSERT INTO "Source" ("id", "name", "url", "type", "category", "maxItemsPerRun", "extractFullArticle", "active", "createdAt", "updatedAt")
SELECT 'seed-serienjunkies', 'Serienjunkies', 'https://www.serienjunkies.de/news.xml', 'RSS', 'Filme und Serien', 15, 1, 1, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE NOT EXISTS (SELECT 1 FROM "Source" WHERE "name" = 'Serienjunkies');

INSERT INTO "Source" ("id", "name", "url", "type", "category", "maxItemsPerRun", "extractFullArticle", "active", "createdAt", "updatedAt")
SELECT 'seed-kino-de', 'Kino.de', 'https://www.kino.de/news/', 'HTML', 'Filme und Serien', 8, 1, 1, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE NOT EXISTS (SELECT 1 FROM "Source" WHERE "name" = 'Kino.de');

INSERT INTO "Source" ("id", "name", "url", "type", "category", "maxItemsPerRun", "extractFullArticle", "active", "createdAt", "updatedAt")
SELECT 'seed-kinocheck', 'Kinocheck', 'https://kinocheck.de/news', 'HTML', 'Filme, Serien', 5, 1, 1, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE NOT EXISTS (SELECT 1 FROM "Source" WHERE "name" = 'Kinocheck');

INSERT INTO "Source" ("id", "name", "url", "type", "category", "maxItemsPerRun", "extractFullArticle", "active", "createdAt", "updatedAt")
SELECT 'seed-filmstarts', 'Filmstarts.de', 'https://www.filmstarts.de/rss/nachrichten.xml', 'RSS', 'Filme und Serien', 5, 1, 1, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE NOT EXISTS (SELECT 1 FROM "Source" WHERE "name" = 'Filmstarts.de');
