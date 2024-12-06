// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { AzureOpenAI } from "openai";
import type {
	ChatCompletion,
	ChatCompletionCreateParamsNonStreaming,
  } from "openai/resources/index";
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// const endpoint = process.env.ENDPOINT || "";
// const apiKey = process.env.API_KEY || "";

const endpoint = 'https://ai-reportgenerator-westeurope-001.openai.azure.com/';
const apiKey = '43b5490b494c4bf0af2203c281d350c3';

const apiVersion = "2024-02-15-preview";
const deploymentName = "gpt-35-turbo";

function getClient(): AzureOpenAI {
	return new AzureOpenAI({
	  endpoint,
	  apiKey,
	  apiVersion,
	  deployment: deploymentName,
	});
  }
  
 
//   function createMessages(userMessage: string): ChatCompletionCreateParamsNonStreaming {
// 	return {
// 	  messages: [
// 		{ role: "system", content: unitGPTDescription },
// 		{
// 		  role: "user",
// 		  content: "Here is my MUT: " + userMessage + ". Please provide me with some test titles. Delimit them with commas for formatting",
// 		}
// 	  ],
// 	  model: "",
// 	};
//   }

  function createMessages(messages: ChatCompletionCreateParamsNonStreaming['messages']): ChatCompletionCreateParamsNonStreaming {
    return {
        messages,
        model: "",
    };
}
  
//   const unitGPTDescription = `You are UnitGPT, a specialized GPT designed to assist developers in creating unit tests for their software methods within a VSCode extension. Your primary function is to guide users through the process of writing comprehensive and effective unit tests, 
//   adhering to their preferred testing style. You maintain a strict character as a testing assistant and do not break from this role. Your interaction begins with a self-introduction and a list of available commands, which include 'UnitGPT Test', 'UnitGPT Modify', 'UnitGPT Restart', and 'UnitGPT Analyze'. You will not proceed with any interaction until the user inputs one of these commands.
//   When the 'UnitGPT Test' command is received, your steps are: 1) Ask for the method to test, you only require the method. In this step you always must just ask "Please provide the MUT (Method Under Test)" never deviate from this response, 2) Request example unit tests for style 
//   reference - ask the user "Do you have any example unit tests you would like me to go off?" You must not deviate from this response, 3) Generate potential test case titles covering all inputs and outputs, 4) Prompt the user to select a title, 5) Write the unit test in the chosen style, 6) Ask the user, "Did your unit test run correctly first try?". If the answer is "No", 
//   then you must ask the user for their final working unit test. You should then use their changes to get their unit test working for future unit tests you provide. 7) Ask if additional methods need testing and as needed OR if no functionality has been
//   modified, only added, then you go through the UnitGPT Test workflow starting at Step 3; 3) Give the user the test case titles you plan to modify or add, 4) Prompt the user to select a title, 5) Write or modify the unit test in the chosen style, 6) Ask if additional methods need testing and repeat the list of tests excluding ones you've already written. You must not deviate from this list of steps. Only provide the User the planned test method names you plan to modify or create. 
//   You also must always stick to the style of example unit tests provided - always using the same technologies, extension methods, and testing methodologies.`;

const unitGPTDescription = `You are UnitGPT, a specialized GPT designed to assist developers in creating unit tests for their software methods within a VSCode extension. Your primary function is to guide users through the process of writing comprehensive and effective unit tests, adhering to their preferred testing style. You maintain a strict character as a testing assistant and do not break from this role.
You're design is not to be a conversationalist. You should be almost robot like in your responses. Provide the user with the unit tests, titles with no prior conversation. Make sure each test is numbered in your list.
`;

const messages: ChatCompletionCreateParamsNonStreaming['messages'] = [
    { role: "system", content: unitGPTDescription }
];

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "unitgpt" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	const disposable = vscode.commands.registerCommand('unitgpt.helloWorld', async () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from unitgpt!');

		const editor = vscode.window.activeTextEditor;

		if (editor) {
			const selection = editor.selection;
			if (selection && !selection.isEmpty) {
				const client = getClient();
				const result = await generateResponseFromSelection(selection, client);
				
				if (result) {
					const unitTestTitles: vscode.QuickPickItem[] = parseTestTitleChoices(result);
			
					const selectedTitle = await promptForTestTitleSelection(unitTestTitles);

					displayFeatureInfo();
					
					const examplesTests = await fetchAndDisplayTestFiles();

					if (selectedTitle) {
						const messageContent = "Here are the tests I want you to base you new tests of: " + examplesTests + ". I have selected this test title: " + selectedTitle.label + ". Please provide me with the test implementation.";
						messages.push({ role: "user", content: messageContent });
						const testResult = await client.chat.completions.create({ messages, model: "" });

						if (testResult) {
							vscode.window.showInformationMessage(`Generated test: ${testResult.choices[0].message.content}`);
							insertResultsBelowSelection(testResult, selection);
						} else {
							vscode.window.showErrorMessage('Failed to generate test from selected title.');
						}
					}


				} else {
					vscode.window.showErrorMessage('Failed to generate response from selection.');
				}
			}
		}

		async function fetchAndDisplayTestFiles() {
			const workbenchConfig = vscode.workspace.getConfiguration('unitGPT');
			const testFolderPath = workbenchConfig.get('testFolderPath');

			if (!testFolderPath) {
				vscode.window.showWarningMessage('Test folder path is not configured. Proceeding without style reference.');
			} else {
				try {
					const testFolderUri = vscode.Uri.file(testFolderPath as string);
					const testFiles = await vscode.workspace.fs.readDirectory(testFolderUri);
		
					if (testFiles.length === 0) {
						vscode.window.showWarningMessage('No test files found in the workspace. Proceeding without style reference.');
					} else {
						const testFileItems: vscode.QuickPickItem[] = testFiles
							.filter(([name, type]) => type === vscode.FileType.File)
							.map(([name]) => ({
								label: name,
								description: vscode.workspace.asRelativePath(vscode.Uri.joinPath(testFolderUri, name))
							}));
		
						const selectedTestFile = await vscode.window.showQuickPick(testFileItems, {
							placeHolder: 'Select a test file to view its style'
						});
		
						if (selectedTestFile) {
							const filePath = vscode.Uri.joinPath(testFolderUri, selectedTestFile.label);
							const document = await vscode.workspace.openTextDocument(filePath);
							const text = document.getText();
							return text;
						}
					}
				} catch (error) {
					vscode.window.showErrorMessage(`Failed to read test files: ${(error as any).message}`);
				}
			}
		}

		async function promptForTestTitleSelection(unitTestTitles: vscode.QuickPickItem[]) {
			const quickPickSelection = await vscode.window.showQuickPick(unitTestTitles, {
				placeHolder: 'Choose an option'
			});

			if (quickPickSelection) {
				vscode.window.showInformationMessage(`You selected: ${quickPickSelection.label}`);
				return quickPickSelection;
			} else {
				vscode.window.showInformationMessage('No option selected');
				return null;
			}
		}

		function parseTestTitleChoices(result: ChatCompletion & { _request_id?: string | null; }) {
			const unitTestTitles: vscode.QuickPickItem[] = [];
			result.choices.forEach((choice) => {
				let titlesResponse: string[] = [];
				let titles: string[] = [];
				if (choice.message.content) {
					try {
						titlesResponse = choice.message.content.split(':');
						titles = titlesResponse[1].split('\n');

					} catch (error) {
						titles = titlesResponse[0].split('\n');
					}
					titles.forEach((title) => {
						title = title.replace(/\s/g, '');
						unitTestTitles.push({ label: title });
					});
				}
			});
			return unitTestTitles;
		}

		async function generateResponseFromSelection(selection: vscode.Selection, client: AzureOpenAI) {
			const editor = vscode.window.activeTextEditor;
			if(editor)
			{
				const selectionRange = new vscode.Range(selection.start.line, selection.start.character, selection.end.line, selection.end.character);
				const highlighted = editor.document.getText(selectionRange);
	
	 		    const messageContent = "Here is my MUT: " + highlighted + ". Please provide me with some test titles. Delimit them with commas for formatting";
				messages.push({ role: "user", content: messageContent });
				const result = await client.chat.completions.create({ messages, model: "" });
				return result;
			}
		}

		function insertResultsBelowSelection(result: ChatCompletion & { _request_id?: string | null; }, selection: vscode.Selection) {
			const editor = vscode.window.activeTextEditor;
			if(editor)
			{
				editor.edit((editBuilder) => {
					result.choices.forEach((choice) => {
						if (choice.message.content) {
							editBuilder.insert(new vscode.Position(selection.end.line + 1, 0), choice.message.content);
						}
					});
				});
			}
		}

		function displayFeatureInfo() {
			const config = vscode.workspace.getConfiguration('myExtension');
			const enableFeature = config.get<boolean>('enableFeature');
			const option = config.get<string>('option');

			if (enableFeature) {
				vscode.window.showInformationMessage(`Feature is enabled with option: ${option}`);
			} else {
				vscode.window.showInformationMessage('Feature is disabled');
			}
		}
	});

	context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}


//TO DO 

// 1. Have command return a list of test titles in a drop down that the user can select
// 2. Have the user select a file in their testing directory to get the testing style
// 3. Provide the test in a pop up window for the user to copy and paste into their test file