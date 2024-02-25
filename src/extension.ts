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

const defaultPath = "~/shell-file.sh";

async function resolveDefaultPath(): Promise<string> {
	return vscode.window.withProgress({
		location: vscode.ProgressLocation.Notification,
		title: "Resolving default path",
		cancellable: false,
	}, () => new Promise<string>((resolve, reject) => {
		const child = require("child_process").exec(
			// use bash to resolve the path, so that it expands ~ to the
			// home directory
			`bash -c "echo ${defaultPath}"`,
			(err: any, stdout: string) => {
				if (err) {
					reject(err);
				} else {
					resolve(stdout.trim());
				}
			},
		);
	}));
}

function looksLikeShellFile(doc: vscode.TextDocument): boolean {
	const isShellLanguage =
		doc.languageId === "shellscript" || doc.fileName.endsWith(".sh");
	return isShellLanguage &&
		doc.getText().includes(startLine) &&
		doc.getText().includes(separatorLine);
}

/** Jump to the shell file at the default path, and populate it with the
 *  template if it doesn't exist. */
async function findShellFile() {
	const resolvedDefaultPath = await resolveDefaultPath();

	// check if the file exists, and if not, create it

	if (!await vscode.workspace.fs.stat(vscode.Uri.file(resolvedDefaultPath)).then(() => true, () => false)) {
		const edit = new vscode.WorkspaceEdit();
		edit.createFile(vscode.Uri.file(resolvedDefaultPath));
		const success = await vscode.workspace.applyEdit(edit);
		if (!success) {
			vscode.window.showErrorMessage("Failed to create file");
			return;
		}
	}

	const doc = await vscode.workspace.openTextDocument(resolvedDefaultPath);
	vscode.window.showTextDocument(doc);

	if (looksLikeShellFile(doc)) {
		vscode.window.showInformationMessage("Shell file already open");
		return;
	}

	if (doc.getText().trim() !== "") {
		vscode.window.showErrorMessage("Shell file is not empty");
		return;
	}

	const edit = new vscode.WorkspaceEdit();
	edit.insert(doc.uri, new vscode.Position(0, 0), template);

	const success = await vscode.workspace.applyEdit(edit);

	if (!success) {
		vscode.window.showErrorMessage("Failed to apply edit");
		return;
	}

	await doc.save();

	vscode.window.showInformationMessage("Shell file created");

	// move the cursor to the new block

	const newCursorPosition = new vscode.Position(3, 0);
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		vscode.window.showErrorMessage("No active editor");
		return;
	}

	editor.selection =
		new vscode.Selection(newCursorPosition, newCursorPosition);
}

function findStartLine(doc: vscode.TextDocument): vscode.TextLine | null {
	for (let i = 0; i < doc.lineCount; i++) {
		const line = doc.lineAt(i);
		if (line.text === startLine) {
			return line;
		}
	}

	return null;
}

/** Insert an empty block at the top of the shell file. */
async function insertShellFileBlock() {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		vscode.window.showErrorMessage("No active editor");
		return;
	}

	const doc = editor.document;
	if (!looksLikeShellFile(doc)) {
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
}

/** Move the block that the cursor is currently on to the top of the file, and
 *  execute the file.*/
async function runShellFileBlock() {
	// find the line that the cursor is currently on
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		vscode.window.showErrorMessage("No active editor");
		return;
	}

	const doc = editor.document;
	const docName = doc.fileName;
	if (!looksLikeShellFile(doc)) {
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

	// TODO: add an option to insert a "clear &&" before the command
	terminal.sendText(`bash ${docName}`);
}

export function activate(context: vscode.ExtensionContext) {
	const commands: [string, (() => void)][] = [
		['shell-file-mode.findShellFile', findShellFile],
		['shell-file-mode.insertShellFileBlock', insertShellFileBlock],
		['shell-file-mode.runShellFileBlock', runShellFileBlock]
	];

	commands.forEach(([command, callback]) => {
		let subscription = vscode.commands.registerCommand(command, callback);
		context.subscriptions.push(subscription);
	});
}

export function deactivate() { }
