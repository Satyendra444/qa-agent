# Demo Guide

This `demo/` folder contains the assets for an end-to-end QA agent proof-of-concept.
It shows how a natural-language requirement can be transformed into structured test
cases, automation scripts, execution results, and evaluation artifacts.

## Files

- `requirement.txt` — example product requirement used as the demo input.
- `prompts/requirement-agent.md` — prompt template for the Requirement Agent.
- `prompts/testcase-agent.md` — prompt template for the Test Case Agent.
- `prompts/automation-agent.md` — prompt template for the Automation Agent.
- `prompts/execution-agent.md` — prompt template for the Execution Agent.
- `sample-output.json` — example of the pipeline output for a single demo session.
- `sample-report.md` — human-readable demo summary describing the generated artifacts.

## Demo Flow

1. Start with `requirement.txt` containing a natural-language requirement.
2. Use `prompts/requirement-agent.md` to extract structured scenarios.
3. Use `prompts/testcase-agent.md` to convert the scenarios into test cases.
4. Use `prompts/automation-agent.md` to generate Playwright automation scripts.
5. Use `prompts/execution-agent.md` to execute the scripts and collect results.

## Example: NoteStly homepage validation

### Requirement

```text
Verify the NoteStly homepage title and description. The page title should be "NoteStly" and the meta description should include "modern note-taking".
```

### Requirement Agent prompt

Use the `prompts/requirement-agent.md` template and provide the requirement text above.
The agent should return structured scenarios such as homepage title validation and
meta description validation.

### Test Case Agent prompt

Use `prompts/testcase-agent.md` to turn those scenarios into test cases. Example
output should include test cases like:

- `Valid homepage title is displayed`
- `Homepage meta description contains modern note-taking`

### Automation Agent prompt

Use `prompts/automation-agent.md` and instruct the agent to generate a Playwright
TypeScript test that:

- opens the NoteStly homepage
- asserts `document.title === "NoteStly"`
- asserts the page meta description contains `"modern note-taking"`
- records screenshots or failures

### Execution Agent prompt

Use `prompts/execution-agent.md` to execute the generated script and return a
structured result with total tests, passed/failed counts, and artifact paths.

## Example Commands

The repo does not yet include a dedicated CLI for the prompt pipeline, but the
following conceptual flow demonstrates the demo intent:

```bash
# Step 1: Generate scenarios from the requirement.
# Step 2: Generate test cases from the scenarios.
# Step 3: Generate automation scripts from the test cases.
# Step 4: Execute the automation scripts and produce results.
```

## Notes

- These files are designed as reusable prompt templates for an AI-driven demo.
- The `sample-output.json` file shows the expected structure of the end-to-end
  session output.
- Use the `src/mcp/playwright-demo.ts` script to verify MCP integration with
  Playwright in the repo.
