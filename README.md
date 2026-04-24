# Nihongo Memo (日本語メモ)

A desktop app for learning Japanese — hiragana, katakana, and vocabulary — with spaced repetition and progressive mastery.

## Features

- **Progressive kana learning** — Learn hiragana and katakana by consonant groups (a-i-u-e-o, ka-ki-ku-ke-ko, etc.)
- **1,200+ vocabulary words** organized into themed units (Greetings, People, Family, Food, Animals, etc.)
- **Mastery system** — 15-level spaced repetition. Words you struggle with appear more often.
- **Multiple quiz types** — Multiple choice, typing, and self-graded modes
- **Gradual introduction** — New words are introduced 5 at a time, only after previous words reach a comfortable level
- **Word details** — Click any word to see descriptions, example sentences with romaji, cultural context, and usage notes
- **Interactive kana chart** — Tracks your progress visually; unlearned characters are greyed out

## Install

Requires [Node.js](https://nodejs.org/) (v18+).

```bash
git clone https://github.com/BerryNotes/nihongo-memo.git
cd nihongo-memo
npm install
npm start
```

## How It Works

### Units
The app is organized into themed units. Each unit teaches:
1. **Kana** — A set of hiragana/katakana characters
2. **Vocabulary** — Words that use only the kana you've learned so far

### Learning Flow
1. New characters/words are **taught** one at a time with pronunciation
2. You're **quizzed** with multiple choice and typing
3. The app tracks your **mastery level** (0-15) for each item
4. New items are only introduced when your current items reach a comfortable level
5. Previous material is **reviewed** in later sessions with spaced repetition

### Mastery Levels
- Correct answer: +1 level
- Wrong answer: -2 levels
- Level 10+: Typing quizzes replace multiple choice
- Level 15: Fully mastered

## Vocabulary Sources

- *Speak Japanese in 90 Days* by Kevin Marx (965 words)
- Wiktionary's 1000 Japanese Basic Words (593 words)
- Merged, deduplicated, and organized into 22 themed categories

## Tech

- Electron
- Vanilla HTML/CSS/JS
- Local storage for progress (no account needed)
- Google Fonts: Noto Sans JP + Inter

## License

ISC
