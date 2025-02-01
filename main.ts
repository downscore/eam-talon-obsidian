import { Editor, MarkdownView, Plugin } from 'obsidian';
import * as commandRunner from "./command_runner";
import * as tinychart from "./tinychart";

export default class MyPlugin extends Plugin {
  async onload() {
    // Initialize the command runner.
    commandRunner.initialize();

    // Register command runner command.
    this.addCommand({
      id: 'run-command',
      name: 'Run Command From Client',
      editorCallback: async (editor: Editor, view: MarkdownView) => {
        await commandRunner.runCommand(editor, view, this.app);
      },
      hotkeys: [
        {
          modifiers: ['Mod', 'Shift'],
          key: 'F18'
        }
      ]
    });

    // Register handler for tinychart code blocks.
    this.registerMarkdownCodeBlockProcessor(
      "tinychart",
      tinychart.tinychartCodeBlockProcessor
    );

    // Register CSS changes.
    // TODO: This also hides controls for changing sidebar content. Figure out how to hide only the
    // tabs.
    // const style = document.createElement('style');
    // style.innerHTML = `
    //     /* Hide tabs. */
    //     .workspace-tab-header-container-inner, .workspace-tab-header-new-tab {
    //         display: none !important;
    //     }
    // `;
    // document.head.appendChild(style);

    // Register a keyboard shortcut for inserting a new line under the current line.
    this.addCommand({
      id: 'insert-new-line-below',
      name: 'Insert New Line Below',
      editorCallback: async (editor: Editor, view: MarkdownView) => {
        // Don't do anything if the editor is not focused.
        if (!editor.hasFocus()) {
          return;
        }

        // Check if the current line is part of a list.
        const current_line_text = editor.getLine(editor.getCursor().line);
        const list_prefix = current_line_text.match(/^(\s*[-+*]\s)/);

        // Insert a new line below the current line and move the cursor there.
        editor.setCursor(editor.getCursor().line, current_line_text.length);
        editor.replaceSelection("\n");

        // Insert the list prefix if we came from a line that was a list item.
        if (list_prefix) {
          editor.replaceSelection(list_prefix[0]);
        }
      },
      hotkeys: [
        {
          modifiers: ['Mod'],
          key: 'Enter'
        }
      ]
    });
  }

  onunload() {
  }
}
