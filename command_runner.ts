import * as obsidian from "obsidian";

import { S_IWOTH } from "constants";
import { mkdirSync, lstatSync } from "fs";
import { open, readFile, stat } from "fs/promises";
import { tmpdir, userInfo } from "os";
import { join } from "path";

import { Request } from "./command_request";
import { Response } from "./command_response";

// Returns the path of the folder containing the request and response files.
function getCommunicationDirPath() {
  // On Windows uid < 0 and the tmpdir is user-specific, so we don't bother with a suffix. This same logic is present in
  // the client.
  const info = userInfo();
  const suffix = info.uid >= 0 ? `-${info.uid}` : "";
  return join(tmpdir(), `obsidian-command-server${suffix}`);
}

// Returns the path of the request file.
function getRequestPath() {
  return join(getCommunicationDirPath(), "request.json");
}

// Returns the path of the response file.
function getResponsePath() {
  return join(getCommunicationDirPath(), "response.json");
}

// Moves the cursor to the given line.
async function jumpToLine(request: Request, editor: obsidian.Editor, view: obsidian.MarkdownView) {
  // Input lines are 1-based, editor lines are 0-based.
  const line = request.args[0];
  if (line < 1) {
    throw new Error(`Line number must be greater than 0, but got: ${line}`);
  }
  editor.setCursor(line - 1, 0);
}

// Selects the given line range.
async function selectLineRange(request: Request, editor: obsidian.Editor, view: obsidian.MarkdownView) {
  const lineFrom = request.args[0];
  const lineTo = request.args[1] || lineFrom;

  // Input lines are 1-based, editor lines are 0-based.
  // Select from start of line to start of subsequent line.
  const start = { line: lineFrom - 1, ch: 0 };
  let end = { line: lineTo, ch: 0 };

  // Special case: Selecting the last line.
  if (lineTo >= editor.lineCount()) {
    const endText = editor.getLine(editor.lineCount() - 1);
    end = { line: editor.lineCount() - 1, ch: endText.length };
  }

  editor.setSelection(start, end);
}

// Copies the given line range to the cursor location, overwriting selection if any.
async function copyLinesToCursor(request: Request, editor: obsidian.Editor, view: obsidian.MarkdownView) {
  const lineFrom = request.args[0];
  const lineTo = request.args[1] || lineFrom;

  // Input lines are 1-based, editor lines are 0-based.
  // Select from start of line to start of subsequent line.
  const start = { line: lineFrom - 1, ch: 0 };
  let end = { line: lineTo, ch: 0 };

  // Special case: Selecting the last line.
  if (lineTo >= editor.lineCount()) {
    const endText = editor.getLine(editor.lineCount() - 1);
    end = { line: editor.lineCount() - 1, ch: endText.length };
  }

  const text = editor.getRange(start, end);
  editor.replaceSelection(text);
}

// Sets the selection to the given offsets. Used to support TextFlow.
async function setSelection(request: Request, editor: obsidian.Editor, view: obsidian.MarkdownView) {
  const offsetFrom = request.args[0];
  const offsetTo = request.args[1];

  const posFrom = editor.offsetToPos(offsetFrom);
  const posTo = editor.offsetToPos(offsetTo);

  editor.setSelection(posFrom, posTo);
}

// Get TextFlow context.
async function getTextFlowContext(request: Request, editor: obsidian.Editor, view: obsidian.MarkdownView) {
  // Get the current selection range as offsets into the file.
  const selectionFromPos = editor.getCursor("from");
  const selectionToPos = editor.getCursor("to");
  const selectionFromOffset = editor.posToOffset(selectionFromPos);
  const selectionToOffset = editor.posToOffset(selectionToPos);

  // Compute the offset at the end of the file.
  const lastLineText = editor.getLine(editor.lineCount() - 1);
  const endPos = { line: editor.lineCount() - 1, ch: lastLineText.length };
  const endOffset = editor.posToOffset(endPos);

  // Get text around the selection.
  // Note: Selected text does not count towards the max text length.
  const MaxTextLength = 20000;
  const textStartOffset = Math.max(0, selectionFromOffset - (MaxTextLength / 2));
  const textEndOffset = Math.min(endOffset, selectionToOffset + (MaxTextLength / 2));
  const text = editor.getRange(editor.offsetToPos(textStartOffset), editor.offsetToPos(textEndOffset));

  return {
    text,
    selectionFromOffset,
    selectionToOffset,
    textStartOffset
  };
}

// Dictionary of command strings to functions that execute them.
const commandHandlers: { [commandId: string]: (request: Request, editor: obsidian.Editor, view: obsidian.MarkdownView) => Promise<any> } = {
  "jumpToLine": jumpToLine,
  "selectLineRange": selectLineRange,
  "copyLinesToCursor": copyLinesToCursor,
  "setSelection": setSelection,
  "getTextFlowContext": getTextFlowContext
};

// Prepares the command runner for reading and writing the request and response files.
export async function initialize(): Promise<void> {
  console.log("Initializing command runner.");

  // Create the communication directory if it does not exist.
  const communicationDirPath = getCommunicationDirPath();
  console.log(`Creating communication directory: ${communicationDirPath}`);
  mkdirSync(communicationDirPath, { recursive: true, mode: 0o770 });

  // Ensure the communication directory path leads to a writable directory.
  const stats = lstatSync(communicationDirPath);
  const info = userInfo();
  if (
    !stats.isDirectory() ||
    stats.isSymbolicLink() ||
    stats.mode & S_IWOTH ||
    // On Windows, uid < 0, so we don't worry about it for simplicity
    (info.uid >= 0 && stats.uid !== info.uid)
  ) {
    throw new Error(
      `Invalid communication directory: ${communicationDirPath}`
    );
  }

  console.log("Initialized command runner.");
}

// Reads a command from the request file, executes it, and writes the result to the response file.
// If the request does not ask for the command output, or does not require waiting for the command to finish, the
// response will be written before the command finishes executing.
export async function runCommand(editor: obsidian.Editor, view: obsidian.MarkdownView) {
  // Make sure the request isn't too old.
  const OBSIDIAN_COMMAND_TIMEOUT_MS = 3000;
  const stats = await stat(getRequestPath());
  if (Math.abs(stats.mtimeMs - new Date().getTime()) > OBSIDIAN_COMMAND_TIMEOUT_MS) {
    new obsidian.Notice('Command request file is too old');
    throw new Error("Request file is too old");
  }

  // Open the response file with exclusive access to prevent conflicts with other instances of this extension.
  const responseFile = await open(getResponsePath(), "wx");

  // Read the request from file.
  let request: Request;
  try {
    request = JSON.parse(await readFile(getRequestPath(), "utf-8"));
  } catch (err) {
    // Cleanup the response file on error.
    await responseFile.close();
    throw err;
  }

  const response: Response = {
    returnValue: null,
    uuid: request.uuid,
    error: null,
    warnings: []
  };

  // Raise a warning if this editor is not active.
  if (!editor.hasFocus) {
    response.warnings.push("This editor is not active");
  }

  try {
    // Execute the command, and wait for it to complete if necessary.
    if (!commandHandlers[request.commandId]) {
      throw new Error(`Unknown command ID: ${request.commandId}`);
    }
    const commandPromise = commandHandlers[request.commandId](request, editor, view);
    if (request.returnCommandOutput) {
      response.returnValue = await commandPromise;
    } else if (request.waitForFinish) {
      await commandPromise;
    }
  } catch (err) {
    // Return the error message in the response.
    response.error = (err as Error).message;
  }

  // Write the response to file. Include a trailing newline to indicate that the response is complete.
  await responseFile.write(`${JSON.stringify(response)}\n`);
  await responseFile.close();
}
