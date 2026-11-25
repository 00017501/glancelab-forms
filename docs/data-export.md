# Results and CSV

The **Responses** tab of a study offers two downloads:

| File | Contents |
|---|---|
| `glancelab-<study>-responses.csv` | One row per participant |
| `glancelab-<study>-codebook.csv` | One row per column: its name, meaning and possible values |

The codebook is generated from the study, so it always matches the responses file and includes the wording of each question.

## Fixed columns

Every responses file starts with these columns.

| Column | Meaning |
|---|---|
| `participant_id` | Anonymous random ID |
| `variant` | The ad version this participant was assigned |
| `status` | `completed`, or `partial` when the participant did not reach the end |
| `interrupted` | `1` when the page was reloaded during a timed step |
| `device_type` | `phone`, `tablet` or `desktop` |
| `viewport_width`, `viewport_height` | Browser window size in CSS pixels |
| `user_agent` | Browser user-agent string |
| `consent_at` | UTC time consent was given |
| `consent_version` | Version of the consent text that was shown |
| `started_at` | UTC start time |
| `completed_at` | UTC finish time, empty when partial |
| `duration_s` | Seconds from start to finish, empty when partial |

## Step columns

After the fixed columns come the columns of each step, in study order. A column name is `s` + the two-digit step number + a suffix, for example `s09_search_rt_ms`. The step number is the one shown in the editor. Names depend only on a step's position and type, never on its wording.

| Step type | Columns | Meaning |
|---|---|---|
| Consent, Text screen | none | |
| Ad exposure | `sNN_stimulus_shown_ms` | Milliseconds the ad was on screen |
| | `sNN_stimulus_status` | `done`, or `interrupted` when the page was reloaded |
| Distractor | `sNN_distractor_attempted` | Sums answered |
| | `sNN_distractor_correct` | Sums answered correctly |
| Question | `sNN_answer` | The answer. For choices, the option's wording |
| | `sNN_answer_other` | Text typed for "Other". Present only when "Other" is allowed |
| Click on image | `sNN_click_x` | Horizontal position, 0 (left) to 1 (right) |
| | `sNN_click_y` | Vertical position, 0 (top) to 1 (bottom) |
| | `sNN_click_pointer` | `mouse`, `touch` or `pen` |
| Timed search | `sNN_search_outcome` | `hit`, `miss`, `timeout` or `interrupted` |
| | `sNN_search_rt_ms` | Milliseconds from the image appearing to the click |
| | `sNN_search_x`, `sNN_search_y` | Click position, 0 to 1 |
| | `sNN_search_hit` | `1` when the click landed inside the target box, else `0` |
| | `sNN_search_pointer` | `mouse`, `touch` or `pen` |

Notes:

- A question that allows several answers puts them in one cell, separated by ` | `.
- An empty cell means the participant did not reach that step, or skipped an optional question.
- Click positions are fractions of the displayed image, so they are comparable across screen sizes.
- Text that a spreadsheet would run as a formula (starting with `=`, `+`, `-` or `@`) is prefixed with `'`.

## Example

For a study with this order:

| # | Step |
|---|---|
| 1 | Consent |
| 2 | Text screen |
| 3 | Ad exposure |
| 4 | Distractor |
| 5 | Question: "Did you notice a price?" |
| 6 | Question: "What was the price?" |
| 7 | Timed search |

the step columns are:

```
s03_stimulus_shown_ms, s03_stimulus_status,
s04_distractor_attempted, s04_distractor_correct,
s05_answer,
s06_answer,
s07_search_outcome, s07_search_rt_ms, s07_search_x, s07_search_y, s07_search_hit, s07_search_pointer
```

## Preparing the data for analysis

1. Keep rows with `status = completed`.
2. Leave out rows with `interrupted = 1`. Those participants reloaded the page during a timed step, so their exposure or search is not comparable.
3. Compare versions using the `variant` column.
4. For search speed, use `sNN_search_rt_ms` among rows where `sNN_search_hit = 1`.

Download the CSV before deleting responses. Deletion is permanent.
