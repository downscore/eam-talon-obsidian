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
  }

  onunload() {
  }
}
