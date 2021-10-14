import * as fs from 'fs-extra';
import * as path from 'path';
import * as vscode from 'vscode';

function escapeRegex(string: string): string {
	return string.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
}

/**
 * Open file after duplicate action.
 */
async function openFile(filepath: string): Promise<vscode.TextEditor> {
	const document = await (vscode.workspace.openTextDocument(filepath) as Promise<vscode.TextDocument>);

	return vscode.window.showTextDocument(document);
}

function overwrite(filepath: string): Promise<vscode.MessageItem | undefined> {
	const message = `The path **${filepath}** already exists. Do you want to overwrite the existing path?`;
	const yesAction = {
		title: 'Yes',
		isCloseAffordance: false,
	};
	const noAction = {
		title: 'No',
		isCloseAffordance: true,
	};

	return vscode.window.showWarningMessage(message, yesAction, noAction) as Promise<vscode.MessageItem | undefined>;
}

/**
 * Duplicate action.
 */
async function duplicator(uri: vscode.Uri): Promise<vscode.TextEditor | undefined> {
	const oldPath = uri.fsPath;
	const oldPathParsed = path.parse(oldPath);
	const oldPathStats = await fs.stat(oldPath);

	const selection: [number, number] = [0, oldPathParsed.name.length];

	const newName = await vscode.window.showInputBox({
		placeHolder: 'Enter the new path for the duplicate.',
		ignoreFocusOut: true,
		value: oldPathParsed.base,
		valueSelection: selection,
	});
	if (!newName) {
		return undefined;
	}

	const newPath = path.join(oldPathParsed.dir, newName);

	// If a user tries to copy a file on the same path
	if (uri.fsPath === newPath) {
		vscode.window.showErrorMessage('You can\'t copy a file or directory on the same path.');

		return undefined;
	}

	// Check if the current path exists
	const newPathExists = await fs.pathExists(newPath);
	if (newPathExists) {
		const userAnswer = await overwrite(newPath);
		if (!userAnswer || userAnswer.title !== 'Yes') {
			return undefined;
		}
	}

	try {
		await fs.copy(uri.fsPath, newPath);

		if (oldPathStats.isFile()) {
			return openFile(newPath);
		}
	} catch (err) {
		const errMsgRegExp = new RegExp(escapeRegex(oldPathParsed.dir), 'g');
		const errMsg = (err as Error).message
			.replace(errMsgRegExp, '')
			.replace(/[\\|\/]/g, '')
			.replace(/`|'/g, '**');

		vscode.window.showErrorMessage(`Error: ${errMsg}`);
	}

	return undefined;
}

export function activate(context: vscode.ExtensionContext): void {
	const command = vscode.commands.registerCommand('duplicate.execute', (uri: vscode.TextDocument | vscode.Uri) => {
		if (!uri || !(uri as vscode.Uri).fsPath) {
			const editor = vscode.window.activeTextEditor;
			if (!editor) {
				return;
			}

			return duplicator(editor.document.uri);
		}

		return duplicator(uri as vscode.Uri);
	});

	context.subscriptions.push(command);
}
