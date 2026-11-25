# Privacy

The consent screen tells participants what is and is not collected. This page lists those promises and how the system keeps each one. The rules for contributors are in [`.agents/rules/privacy.md`](../.agents/rules/privacy.md).

## What is stored about a participant

Only this, and only after consent:

- a random anonymous ID
- the assigned ad version
- answers, reaction times and click positions
- device type, browser window size, user agent and pointer type
- timestamps, including the consent time and the consent text version

## What is never stored or logged

- IP addresses, in any form
- names, email addresses or location
- tracking cookies

## How each promise is kept

| Promise | How it is enforced |
|---|---|
| No IP address is stored or logged | Uvicorn runs with `--no-access-log`. The `Caddyfile` has no access log and excludes the error loggers that would record a visitor's address. No table has a column for it. The app's own logs contain event names, IDs and counts only. |
| Nothing is loaded from third parties | Both frontends are built and served by the app. jsPsych is bundled, not loaded from a CDN. Images are streamed through the app at `/img/…`. A Content-Security-Policy header limits every page to this origin. |
| Nothing is saved before consent | Opening a study link only reads the title and consent text. The session row is created by the request that carries the agreement. Declining writes nothing. |
| Leaving deletes the data | "Leave study" deletes the session and its results from the database. It is a real deletion, not a flag. |
| Results are anonymous | The CSV and the Responses table contain the random ID and study data only. |
| The ad is shown once | The server records that a timed step started before the browser shows it. After a reload the step is closed as interrupted and skipped. |
| The admin panel is protected | HTTPS only. The login cookie is signed, `Secure`, `HttpOnly` and `SameSite=Strict`. Login attempts are rate limited. |

The login rate limiter is the one place that reads a client address. It keeps it in memory to count failed attempts and never writes it anywhere.

## Deletion

| Action | Where | Effect |
|---|---|---|
| Leave study | Participant, any time | Deletes that participant's session and results |
| Delete one response | Responses tab | Deletes that session and its results |
| Clear responses | Responses tab | Deletes every response of the study |
| Delete study | Studies list | Deletes the study and its responses |
| Delete all data | Settings | Deletes all responses, and optionally all studies and images |

To remove everything from the server as well, see [Deployment](deployment.md#taking-it-down).

## Checking the server yourself

This searches the logs of a running deployment for anything that looks like a visitor's address:

```bash
docker compose logs | grep -E '([0-9]{1,3}\.){3}[0-9]{1,3}' | grep -v -e '0.0.0.0' -e '127.0.0.1' -e ' 172\.' -e ' 10\.'
```

It should print nothing that looks like a visitor's address. The excluded ranges are the server's own and Docker's internal network.
