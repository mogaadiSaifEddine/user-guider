# Surveys

Surveys ask your users a few short questions inside your app: how likely they are to recommend you (NPS), how easy a task was, which features they use, or what you could do better.

Create one with **New guide → Survey**. A new survey starts with an NPS question and an open text question; change or delete them as you like.

## Question types

| Type | The user… | Moves on |
| --- | --- | --- |
| **NPS (0–10)** | picks a score from 0 to 10 | as soon as they pick |
| **Rating scale** | picks 1 to 3, 4, 5, 6, 7 or 10 | as soon as they pick |
| **Single choice** | picks one answer | as soon as they pick |
| **Multiple choice** | ticks any number of answers | with the **Next** button |
| **Open text** | types an answer (up to 2000 characters) | with the **Next** button (or Ctrl+Enter) |

Every question has a text and an optional description (Markdown-style **bold**, *italic* and links work). NPS and rating questions can have words under each end of the scale, e.g. *Not likely* / *Very likely*.

Questions are **required** by default. Untick *Required* to add a **Skip** button.

A survey can have up to 20 questions, but short surveys get far more answers: one to three questions is a good size.

## Look and position

- **Position**: a card in the bottom right or bottom left corner (it doesn't cover the page), or a centered modal over a darkened page.
- **Progress**: shows *1 of 3* at the bottom.
- **Next / Submit labels**: the button text on multiple-choice and text questions. The last question shows the Submit label.
- **Thank-you message**: shown after the last answer, and closes by itself after 4 seconds.

The preview shows the question you're editing in your workspace theme.

## When it shows

Surveys use the same [targeting](targeting) as tours and announcements: pages, user rules, a delay, **Show again**, and priority. A survey can also be started only manually, from your code with `LocatifyGuides.start("<survey id>")`, from a checklist item, or from a button in a tour step or announcement (*Start another guide*).

Only one tour, announcement or survey is on screen at a time.

## What counts

- **Saw it**: the survey appeared.
- **Completed**: the user got through the last question (answered or skipped it).
- **Dismissed**: closed with × or Esc before the end.

Answers are saved **one at a time, as they're given**, so a user who answers the NPS question and then closes the survey still counts in the NPS score. If a user answers the same survey again (with *Show again* set to show it again), their newest answer replaces the old one.

## Results

Open **Analytics** from the survey's editor:

- **Question funnel**: how many people reached each question. A big drop shows where people give up.
- **NPS**: the score (% promoters − % detractors, from −100 to +100), the split into detractors (0–6), passives (7–8) and promoters (9–10), and the number of people who gave each score.
- **Rating**: the average and the number of people who gave each score.
- **Choices**: how many people picked each answer, as a share of everyone who answered. For multiple choice the shares can add up to more than 100%.
- **Open text**: the latest 50 answers, with who wrote them and their company.

**Export CSV** downloads every answer: one row per person, one column per question, plus their id and company. Each user's answers also show on their page under **Users**.

## Editing a live survey

Edits reach users when you publish. You can reword questions safely. If you **delete** a question or an answer option, its earlier answers stay in the database but no longer show in the results. If you change a question's type, publish it as a new question instead, so old and new answers aren't mixed.
