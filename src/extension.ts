import * as vscode from 'vscode';

const startLine =
	"### START ##########################################################";
const separatorLine =
	"exit ###############################################################";

const template = `
#!/usr/bin/env bash
# lines above START get run every time

${startLine}

echo 'hello world'

${separatorLine}
`.trim();

const newBlock = `


${separatorLine}
`;

function findStartLine(doc: vscode.TextDocument): vscode.TextLine | null {
	for (let i = 0; i < doc.lineCount; i++) {
		const line = doc.lineAt(i);
		if (line.text === startLine) {
			return line;
		}
	}

	return null;
}

export function activate(context: vscode.ExtensionContext) {
	const commands: [string, (() => void)][] = [
		// Jump to the shell file if it's already open, and create a new one
		// with filename "foo.sh" in the current directory if not, initialized
		// with string "empty shell file".
		['shell-file-mode.openShellFile', async () => {
			const editor = vscode.window.activeTextEditor;
			if (editor) {
				const doc = editor.document;
				const docName = doc.fileName;
				if (docName.endsWith(".sh")) {
					vscode.window.showInformationMessage("Shell file already open");
					return;
				}
			}

			const doc = await vscode.workspace.openTextDocument({
				language: 'shellscript', content: template
			});

			vscode.window.showTextDocument(doc);
		}],
		// Insert an empty block at the top of the shell file.
		['shell-file-mode.insertBlock', async () => {
			const editor = vscode.window.activeTextEditor;
			if (!editor) {
				vscode.window.showErrorMessage("No active editor");
				return;
			}

			const doc = editor.document;
			const docName = doc.fileName;
			if (!docName.endsWith(".sh")) {
				vscode.window.showErrorMessage("Not a shell file");
				return;
			}

			const foundStartLine = findStartLine(doc);
			if (foundStartLine === null) {
				vscode.window.showErrorMessage("No start line found");
				return;
			}

			const edit = new vscode.WorkspaceEdit();
			edit.insert(doc.uri, foundStartLine.rangeIncludingLineBreak.end, newBlock);

			const success = await vscode.workspace.applyEdit(edit);

			if (!success) {
				vscode.window.showErrorMessage("Failed to apply edit");
				return;
			}

			await doc.save();

			vscode.window.showInformationMessage("Block inserted");

			// move the cursor to the new block

			const newCursorPosition = foundStartLine.range.end.translate(2);
			editor.selection =
				new vscode.Selection(newCursorPosition, newCursorPosition);
		}],
		// Move the block that the cursor is currently on to the top of the
		// file, and execute the file.
		['shell-file-mode.runShellFile', async () => {
			// find the line that the cursor is currently on
			const editor = vscode.window.activeTextEditor;
			if (!editor) {
				vscode.window.showErrorMessage("No active editor");
				return;
			}

			const doc = editor.document;
			const docName = doc.fileName;
			if (!docName.endsWith(".sh")) {
				vscode.window.showErrorMessage("Not a shell file");
				return;
			}

			const foundStartLine = findStartLine(doc);
			if (foundStartLine === null) {
				vscode.window.showErrorMessage("No start line found");
				return;
			}

			// find the first separator line (or start line) on or above the
			// cursor

			const cursorLine = editor.selection.active.line;

			let separatorLineAbove = null;
			for (let i = cursorLine; i >= 0; i--) {
				const line = doc.lineAt(i);
				if (line.text === separatorLine || line.text === startLine) {
					if (line.text === startLine && foundStartLine.lineNumber !== i) {
						vscode.window.showErrorMessage("Multiple start lines found, invalid shell file");
						return;
					}

					separatorLineAbove = line;
					break;
				}
			}

			if (separatorLineAbove === null) {
				vscode.window.showErrorMessage("No separator line found above cursor");
				return;
			}

			// find the first separator line starting with the line after the cursor

			let separatorLineBelow = null;
			for (let i = cursorLine + 1; i < doc.lineCount; i++) {
				const line = doc.lineAt(i);
				if (line.text === separatorLine) {
					separatorLineBelow = line;
					break;
				}
			}

			if (separatorLineBelow === null) {
				vscode.window.showErrorMessage("No separator line found below cursor");
				return;
			}

			// move the code block to the top of the file

			const blockRange =
				new vscode.Range(separatorLineAbove.range.end, separatorLineBelow.range.end);
			const block = doc.getText(blockRange);

			const edit = new vscode.WorkspaceEdit();
			edit.delete(doc.uri, blockRange);
			edit.insert(doc.uri, foundStartLine.range.end, block);

			const success = await vscode.workspace.applyEdit(edit);

			if (!success) {
				vscode.window.showErrorMessage("Failed to apply edit");
				return;
			}

			// save the file

			await doc.save();

			// check existing terminals for one with the same name, and create a
			// new one if not

			let terminal =
				vscode.window.terminals.find(terminal =>
					terminal.name === "shell-file-mode");
			terminal = terminal || vscode.window.createTerminal("shell-file-mode");

			// execute the file, and print the output to the terminal while
			// preserving focus on the current editor

			terminal.show(true);
			terminal.sendText(`bash ${docName}`);
		}]
	];

	commands.forEach(([command, callback]) => {
		let subscription = vscode.commands.registerCommand(command, callback);
		context.subscriptions.push(subscription);
	});
}

export function deactivate() { }