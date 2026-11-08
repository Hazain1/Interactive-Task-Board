# Interactive Task Board (Kanban Lite)

A responsive task board for organising work across three stages: **To Do**, **In Progress** and **Completed**. Built with plain HTML5, CSS3 and vanilla JavaScript (ES6+), with no frameworks or build step.

**Live demo:** https://hazain1.github.io/Interactive-Task-Board/

## Features

### Core
- **Add tasks** with a title, optional description, category (Development, Design, Marketing) and priority (Low, Medium, High). The form validates input and shows a message for any missing field.
- **Move tasks** between columns with the status menu on each card.
- **Delete tasks**, with an *Undo* button in a short notification in case of a mistake.
- **Persistence**: tasks are saved in `localStorage` and survive page refreshes. Invalid or corrupted saved data is ignored instead of breaking the page.

### Interface
- **Responsive layout**: three columns on desktop, two on tablet, one stacked column on mobile.
- **Priority colours**: High is coral red, Medium is amber, Low is green (left border and badge on every card).
- **Search and filters**: search by title, filter by category and by priority, and clear all filters with one click.
- Cards inside each column are sorted by priority, high first.

### Bonus features
- **Drag and drop** using the native HTML5 Drag and Drop API, with a highlighted drop zone.
- **Dark mode** toggle. The choice is remembered, and the first visit follows the system setting.
- **Task counter** in the header showing active, completed and total tasks.

### Other details
- Task text is inserted with `textContent`, so titles containing HTML are shown as text and never executed.
- Event delegation: one listener on the board handles every card.
- Keyboard focus styles, labelled form controls and reduced-motion support.
- Open tabs stay in sync through the `storage` event.

## Project structure

```
index.html   page structure (header, form, filters, three columns)
styles.css   theme variables, layout, cards, dark mode, breakpoints
script.js    state, localStorage, rendering, filters, drag and drop
```

## Running locally

No installation needed. Open `index.html` in a browser, or serve the folder:

```bash
python -m http.server 8000
# then open http://localhost:8000
```

## Deployment

Hosted with GitHub Pages from the `main` branch (Settings → Pages → Deploy from a branch → `main` / root).
