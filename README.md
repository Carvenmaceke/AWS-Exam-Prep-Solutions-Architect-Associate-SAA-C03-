# AWS SAA-C03 Exam Prep

A practice-test and study website for the **AWS Certified Solutions Architect – Associate (SAA-C03)** exam. It uses the 1,019 questions, answers and explanations from the SAA-C03 question document. Nothing is added or reworded.

## Features

- **New test**: choose how many questions. They are picked at random from one of these pools:
  - **New questions only**: questions you have never attempted
  - **Repeat questions**: ones you got wrong last time, or any you have already done
  - **Mix**: the whole bank
- **Write the test**: one question at a time, with a question palette, flags, and checkboxes for "Choose two/three" questions.
- **Rewrite what you got wrong**: after you submit, you can redo only the wrong questions before you see the answers. You can repeat this as many times as you like.
- **Marked paper**: every question is marked right, wrong or "corrected on rewrite". Your picks and the correct answer are highlighted. The document's explanation is shown for each question you got wrong. For correct ones, you can open it if you want.
- **Study mode**: browse all questions with answers and explanations. You can search by text or question number, and filter by "wrong last time", "never attempted" and more.
- **History**: past tests with scores. You can reopen any marked paper.

Progress is saved in your browser (`localStorage`), so it stays on the device and browser you use.

## Running it

It's a static site with no build step. Either:
- open `index.html` in a browser, or
- serve the folder (GitHub Pages, or `python3 -m http.server`).

## Files

| Path | What it is |
| --- | --- |
| `index.html`, `styles.css`, `app.js` | The app |
| `data/questions.js` | Question bank extracted from the PDF |
| `img/` | Exhibits (IAM policies) for the 7 questions that show them as images |
| `tools/parse.py`, `tools/images.py` | Scripts used to extract the questions and exhibits from the PDF |

### Regenerating the data

```sh
pdftotext -layout saa-c03.pdf saa.txt
python3 tools/parse.py saa.txt questions.json
python3 tools/images.py saa-c03.pdf questions.json img   # crops exhibits, writes PNGs
```

Then wrap `questions.json` as `window.QUESTIONS = …;` in `data/questions.js`. The site expects `.jpg` exhibits, so convert the PNGs (the committed ones are JPEGs).

## Notes on the source document

A few defects in the PDF were fixed during extraction without changing any content:
- Q125 labels its fifth option as a second "D." It is stored as E, which matches the answer (AE) and the explanation.
- Q756 runs options B, C and D together. They were split.
- Q868 has no option A in the document, so it only shows B–D.
- "VPUpdate" (a lost "C. ") was restored to "VPC. Update" in the options where it appears.

Other typos in the document (for example, a few OCR-style misspellings) were left as they are.
