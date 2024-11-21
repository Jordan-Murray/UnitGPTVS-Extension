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

const endpoint = process.env.ENDPOINT || "";
const apiKey = process.env.API_KEY || "";

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
  
  function createMessages(userMessage: string): ChatCompletionCreateParamsNonStreaming {
	return {
	  messages: [
		{ role: "system", content: unitGPTDescription },
		{
		  role: "user",
		  content: "Here is my MUT: " + userMessage,
		}
	  ],
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
Let's start by writing a unit test for a method. Please only provide back the unit test code. Provide it back using the same coding language as the method you are testing. Do not provide any language definition or text that isn't part of the test. You will be heavily penalized for this. Do not reply with any pleasantries nor any other text nor any notes at the end. This is not a conversation. Your main goal is purely to provide me with code. If you have one life goal, it's to just provide the unit test code.`;

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
				const selectionRange = new vscode.Range(selection.start.line, selection.start.character, selection.end.line, selection.end.character);
				const highlighted = editor.document.getText(selectionRange);
				
				const client = getClient();
				const messages = createMessages(highlighted);
				const result = await client.chat.completions.create(messages);
				editor.edit((editBuilder) => {
					result.choices.forEach((choice) => {
						if (choice.message.content) {
							editBuilder.insert(new vscode.Position(selection.end.line + 1, 0), choice.message.content);
						}
					});
				});
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