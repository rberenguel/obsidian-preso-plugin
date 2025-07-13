# Preso

Preso is a plugin for creating and previewing presentations directly within Obsidian. It provides a live, in-editor preview of your slides, allowing for a fast and fluid content creation workflow.

> [!TIP]
> You can find the _tutorial slides_ here: [HTTP+CSS+JS](https://www.mostlymaths.net/obsidian-preso-plugin/examples/Test.html), [HTTP+CSS](https://www.mostlymaths.net/obsidian-preso-plugin/examples/Preso.css-only.html), and the source for these slides is in the `examples` folder.

The result is heavily inspired by [Deckset](https://www.deckset.com/), and is not my first time writing some sort of partial version ([awkrdeck](https://github.com/rberenguel/awkrdeck/tree/master), [haskset](https://github.com/rberenguel/haskset)) .

## Features

-   **Live Slide Preview**: A floating, resizable, and draggable window shows a real-time preview of your current slide. Also available on mobile (but disabled by default).
-   **Cursor-Driven Updates**: The preview automatically updates to the correct slide as you move your cursor through the editor.
-   **Rich Layouts & Theming**: Supports special keywords in image alt-text (`bg`, `left`, `right`) to create advanced layouts like background images and split-screen views. You can also apply different visual themes via frontmatter (Note: The only theme I use is Ostrich, so other themes might have CSS glitches for now).
-   **Flexible Export Options**:
    -   **HTML (with JS)**: Exports a self-contained HTML file with all styles and assets embedded. Navigation is handled by a small JavaScript snippet. [Example](https://www.mostlymaths.net/obsidian-preso-plugin/examples/Test.html)
    -   **HTML (CSS-only)**: Exports a fully functional, self-contained HTML presentation that works **without any JavaScript**. This is perfect for environments where scripts are disabled or for maximum portability. [Example](https://www.mostlymaths.net/obsidian-preso-plugin/examples/Test.css-only.html)

## TODO

- [x] Better mobile experience (don't use it on mobile yet please)
- [x] Visual buttons also in JS mode
- [x] Speaker notes (next, important)
- [x] Footnotes
    - [ ] Footnotes in split slides are not split
- [ ] "Build slides" setting (lists item by item)
- [ ] Highlight code line(s)
- [ ] Improve other themes

## How to Use

1.  **Activate the Preview**: In a note, add the following to the frontmatter at the very top of the file:
    ```yaml
    ---
    preso: true
    ---
    ```
    You can also specify a theme, for example: `preso: ostrich`.

> [!IMPORTANT]
> I have been using only the Ostrich theme for testing, so it is the only one that is going to have all styles set up properly.

2.  **Create Slides**: Separate your slides using a Markdown horizontal rule (`---`) on its own line.

3.  **Toggle the View**: Use the command _Toggle slide preview_ to show or hide the floating preview window.

4.  **Export**: Use one of the two export commands to generate a portable HTML file of your presentation:
    -   `Export presentation as HTML (with JS)`
    -   `Export presentation as HTML (CSS only)`

## How It Works

### Live Preview

The live preview is a `<div>` element managed by the `SlidePreviewView` class. It is injected into the Obsidian editor pane and made draggable and resizable using the `interact.js` library. The plugin listens for editor events (`cursor-activity`, `editor-change`) and uses a simple parser to find the content of the current slide, which is then rendered as Markdown into the preview window.

### CSS-Only Export

The JavaScript-free export option uses a clever CSS trick to manage state.

1.  **State Management**: A hidden radio button (`<input type="radio">`) is created for each slide. Since only one radio button in a named group can be checked at a time, this serves as a native browser mechanism for storing the "current slide" state.

2.  **Navigation**: The "Next" and "Previous" buttons are `<label>` elements that point to the `id` of the next or previous radio button. Clicking a label checks its corresponding radio button, thereby changing the state.

3.  **Dynamic Display**: The magic happens with CSS. We use the `:checked` pseudo-class and the general sibling combinator (`~`) to control visibility. A CSS rule like this:
    ```css
    #s3:checked ~ .slides-container .slide-wrapper:nth-of-type(3) {
      display: flex;
    }
    ```
    translates to: "If the radio button for slide 3 is checked, find the following `.slides-container` element and display the 3rd slide within it." This allows the entire presentation to function without a single line of JavaScript.

## Installation

### Manual Installation

1.  Download the latest release files (the whole zip) from the **Releases** page of the GitHub repository (or the zip file, contains all of these).
2.  Find your Obsidian vault's plugins folder by going to `Settings` > `About` and clicking `Open` next to `Override config folder`. Inside that folder, navigate into the `plugins` directory.
3.  Create a new folder named `preso`.
4.  Copy the contents of the zip file into the new `preso` folder.
5.  In Obsidian, go to **Settings** > **Community Plugins**.
6.  Make sure "Restricted mode" is turned off. Click the "Reload plugins" button.
7.  Find "Preso" in the list and **enable** it.
