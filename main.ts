import { App, Editor, MarkdownView, Plugin } from 'obsidian';
import * as commandRunner from "./command_runner";

export default class MyPlugin extends Plugin {
  async onload() {
    // Initialize the command runner.
    commandRunner.initialize();

    // Register command runner command.
    this.addCommand({
      id: 'run-command',
      name: 'Run Command From Client',
      editorCallback: async (editor: Editor, view: MarkdownView) => {
        await commandRunner.runCommand(editor, view);
      },
      hotkeys: [
        {
          modifiers: ['Mod', 'Shift'],
          key: 'F18'
        }
      ]
    });
  }

  onunload() {
  }
}
