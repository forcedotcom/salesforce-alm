# SOQL Parser

This SOQL parser uses an antlr grammar produced by Mulesoft. To fix any bugs in the parser, do not directly modify any of the `SOQL*.js` files. Instead, fix it in the parser and regenerate the files. 

1. Set up antlr on your machine. https://github.com/antlr/antlr4/blob/master/doc/getting-started.md
1. Generate the js files and move the generated files to the gen folder. `antlr4 -Dlanguage=JavaScript SOQL.g4 && mv SOQL*.js ../../../gen/`
1. Add `/* eslint-disable */` to the top of the generated js files.