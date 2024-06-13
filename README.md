# SML Buddy

## Overview

**SML Buddy** is a VSCode extension that helps students to receive instant feedback
on their assignments written in Standard ML (SML) by providing counterexamples to their solutions.

It is designed to be used with the [SML/NJ](https://www.smlnj.org/) compiler.

## Building

1. Clone the repository.
2. Run `npm install` to install the dependencies.
3. Install the Visual Studio Code Extension Manager by running `npm install -g @vscode/vsce`.
4. Run `vsce package` to create the `.vsix` file.

## Benchmarks

1. Clone the repository.
2. Run `npm install` to install the dependencies.
3. Run `compile-benchmark` to compile the algorithm.
4. Run `benchmark` to launch a benchmark.
5. Choose one of the available benchmarks and a submission.

## Installing

1. Download `.vsix` file from repository's artifacts or build it yourself.
2. Open Visual Studio Code.
3. Go to Extensions.
4. Click on the three dots in the top right corner.
5. Select "Install from VSIX...".
6. Choose the `.vsix` file.
7. Install [File Downloader Extension](https://marketplace.visualstudio.com/items?itemName=mindaro-dev.file-downloader).

## Usage

1. Click on the SML Buddy icon in the Activity Bar.
2. Load the assignment file by opening it locally or by providing a URL.
   All available functions for verification will appear in the sidebar.
3. Write your solution in the editor. Verifiable functions will be highlighted using gutter decorations.
   These decorations reflect status of the verification.
4. Click on the run icon next to function name to verify it.
5. If counterexample found, the new document will appear that contains verbose explanation about the case.
   Otherwise, you will be notified that the function is verified.

## Notes

1. The extension tries to find a counterexample in 60-second timeframe.
   If it fails to do so, it's assumed that your solution is OK, but it is still possible
   that some complex counterexample exists.
2. The extension doesn't support usage of the common library and you have to implement any
   function that you are using.
3. Modules capabilities, expressions sequencing, records, vectors and type aliasing is not supported.
4. The extension aims to search for **logical** errors and not syntax/semantics errors.
   Verify that your code compiles before searching for counterexamples.

