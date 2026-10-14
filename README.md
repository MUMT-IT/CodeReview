# Code Review Journal

A GitHub Pages archive of Markdown review notes. Readers can search the full text, filter by topic and an inclusive date range, and share a filtered URL. Sessions appear newest first. The archive is initially empty; the template is not published as a real review.

## Add a session

1. Copy `templates/session.md` to `_sessions/YYYY-MM-DD-short-title.md`.
2. Set `title`, `date` (the review date, `YYYY-MM-DD`), `topics` (a YAML list), `repository`, and `summary`.
3. Replace the template body with your review notes. Use consistent topic spelling, such as `Flask`, `Security`, or `Database`.
4. Commit and push. Jekyll creates the session page and updates the search index automatically.

Each filename must be unique. Multiple reviews on the same day can use different short titles. Dates use Asia/Bangkok. The archive searches titles, summaries, repositories, topics, and note bodies.

## Publish on GitHub Pages

In **Settings → Pages → Build and deployment**, select **Deploy from a branch**, then your default branch and **/ (root)**. Save, then push these files. GitHub builds the Jekyll site automatically.

Expected address: https://mumt-it.github.io/CodeReview/

For a renamed repository or custom domain, update `url` and `baseurl` in `_config.yml`. This repository does not include a deployment workflow because branch publishing handles the Jekyll build.

## Local preview

```sh
bundle install
bundle exec jekyll serve
```

Open http://localhost:4000/CodeReview/ . Generated files are ignored by Git.

Only put notes intended for publication in `_sessions`: session pages and the full-text search index are part of the published site.
