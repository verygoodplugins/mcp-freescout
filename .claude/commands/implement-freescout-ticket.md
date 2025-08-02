---
allowed-tools: Bash(curl:*), Bash(jq:*), Bash(gh:*), Bash(find:*), Bash(grep:*), Bash(git:*), Bash(ls:*), Bash(mkdir:*), Bash(cp:*), Bash(awk:*), Bash(wc:*), Bash(tr:*), Bash(./vendor/bin/*), mcp_playwright_browser_navigate, mcp_playwright_browser_take_screenshot, mcp_playwright_browser_click, mcp_playwright_browser_type, mcp_playwright_browser_resize, mcp_playwright_browser_close
auto-approve: true
description: Implement FreeScout ticket with testing, PR creation, customer reply, and documentation updates
argument-hint: <ticket-number> [additional context] | <freescout-ticket-url> [additional context]
---

# Implement FreeScout Ticket with Full Workflow

Please implement the FreeScout ticket following this comprehensive workflow using structured XML tags for clarity.

<input>
$ARGUMENTS (FreeScout ticket ID or URL, with optional context)
</input>

<project_context>
**Note**: This workflow is plugin-agnostic. The AI will understand the specific project name, scope, and coding standards from the project's CLAUDE.md and instructions.md files. References to "the plugin" in this workflow refer to the current project being worked on.
</project_context>

<instructions>
## Interactive Setup

**IMPORTANT**: Before starting, check if $ARGUMENTS is empty or just contains whitespace.

If $ARGUMENTS is empty, STOP and ask the user:
<prompt_template>
"What FreeScout ticket would you like me to implement? Please provide:
- A ticket number (e.g., 12345)  
- A FreeScout ticket URL
- Or the ticket ID
- Optionally include additional context or suggestions after the ticket ID"
</prompt_template>

Wait for their response before proceeding.

## Parse Arguments
<argument_parsing>
1. **Extract ticket ID**: First argument should be the ticket ID or URL
2. **Extract additional context**: Everything after the ticket ID is treated as additional context/suggestions
3. **Store context**: Save any additional context to reference during implementation
</argument_parsing>
</instructions>

<setup_steps>
## Setup Steps

<ticket_extraction>
4. **Extract ticket ID from argument**:
   - If numeric: Use directly as ticket ID
   - If URL: Extract ticket ID from URL pattern
</ticket_extraction>

<api_integration>
5. **Get ticket details via FreeScout API**:
   ```bash
   # Get conversation with threads included
   curl -s -H "X-FreeScout-API-Key: $FREESCOUT_API_KEY" \
        "$FREESCOUT_URL/api/conversations/$TICKET_ID?embed=threads" | jq '.'
   ```
   
   <api_response_structure>
   **FreeScout API Response Structure**:
   - `_embedded.threads[]`: Array of conversation messages
   - `_embedded.threads[].type`: The type of message (note, customer, user)
   - `_embedded.threads[].body`: HTML content of the message
   - `_embedded.threads[].created_by_customer`: Boolean for customer messages
   - `_embedded.customer`: Customer details (email, first_name, last_name)
   - `status`: The status of the ticket (active, pending, closed, spam)
   - `user_id`: Currently assigned user ID
   </api_response_structure>
</api_integration>

<information_extraction>
6. **Extract key information**:
   - Customer email and name from `_embedded.customer`
   - Issue description from customer messages (type=customer)
   - Any code snippets or error messages from thread bodies
   - Check internal notes (type=note) for mentions of testing done by a team member
   - Extract any attachment URLs from `_embedded.threads[].attachments[]`
</information_extraction>

<attachment_handling>
7. **Check for attachments**:
   - If attachments exist, list them and ask user to provide local paths if needed
   - Note any visual requirements or screenshots provided
</attachment_handling>
</setup_steps>

<testing_phase>
## Testing Phase

<testing_decision>
8. **Determine if testing is needed**:
   - Skip if issue in ticket has already been confirmed reproducible by a team member
   - Skip if customer provided their own code solution
   - Otherwise, reproduce the issue:
     <reproduction_steps>
     a. Set up test environment based on ticket details
     b. Use Playwright browser if UI testing is needed
     c. Document reproduction steps
     d. Take "before" screenshot if applicable
     </reproduction_steps>
</testing_decision>
</testing_phase>

<analysis_and_planning>
## Analysis & Planning

<code_research>
9. **Search for related code**:
   - Use ticket keywords to find relevant files
   - For complex searches across multiple files, use Task tool to manage context
   - Check for similar past issues or patterns
   - Search for known limitations or third-party plugin conflicts
</code_research>

<issue_analysis>
10. **Analyze the issue and plan solution**:
    - Review ticket details, customer messages, and any provided context
    <bug_classification>
    - **First determine if this is a bug we can fix**:
      - Is it a third-party plugin limitation (like Elementor copy/paste issues)?
      - Is it expected behavior that needs clarification?
      - Is it a configuration issue rather than a bug?
    </bug_classification>
    - If it's NOT a bug, skip to drafting explanatory reply
    - If it IS a bug, identify root cause and plan implementation
    - Consider multiple solution approaches
    - Factor in any additional context provided by user
    - Plan implementation strategy
</issue_analysis>

<solution_review>
11. **Present solution for review**:
    - STOP before implementing and present the proposed solution:
    <solution_template>
    ```
    "Based on the ticket analysis, here's my proposed solution:
    
    ## Issue Summary:
    [Brief description of the problem]
    
    ## Root Cause:
    [What's causing the issue]
    
    ## Proposed Solution:
    [Detailed plan for the fix]
    
    ## Files to Modify:
    [List of files that will be changed]
    
    ## Additional Context Considered:
    [Reference any user-provided context]
    
    ## Alternative Approaches:
    [Other options considered]
    
    Would you like me to proceed with this implementation, or do you have feedback/modifications? (proceed/modify)"
    ```
    </solution_template>
    - Wait for user approval or feedback before continuing
    - If user provides modifications, incorporate them into the plan
</solution_review>
</analysis_and_planning>

<alternative_workflow>
## Alternative: Explanatory Reply (No Code Changes Needed)

<explanatory_reply>
**If the issue is NOT a plugin bug that can be fixed**, skip implementation and go directly to:

11a. **Draft explanatory reply**:
    <research_requirements>
    - Research the actual cause (third-party limitations, expected behavior, etc.)
    - Use WebSearch to find supporting evidence (GitHub issues, documentation, forums)
    - Use WebFetch to examine specific issue pages or documentation
    - Draft a clear explanation for the customer with specific evidence
    - Include links to evidence and suggest workarounds if available
    </research_requirements>
    - Skip to step 18 to add the draft reply to FreeScout
</explanatory_reply>
</alternative_workflow>

<implementation>
## Implementation

<fix_implementation>
12. **Implement the fix** (only if this IS a plugin bug that can be fixed):
   <implementation_requirements>
   - Follow project coding standards (reference CLAUDE.md or instructions.md)
   - Ensure backward compatibility
   - Add appropriate error handling
   </implementation_requirements>
   
   <behavior_change_check>
   - **Check for behavior changes**: If the implementation modifies existing functionality, STOP and ask:
     <behavior_change_template>
     ```
     "This fix/feature will change existing behavior:
     - Current behavior: [describe current functionality]
     - New behavior: [describe what will change]
     - Affected users: [who might be impacted]
     
     This could affect customers who rely on the current behavior. 
     Should I proceed with this change? (y/n)
     
     Alternative: [suggest a backward-compatible approach if possible]"
     ```
     </behavior_change_template>
   - Only proceed with behavior changes after explicit approval
   </behavior_change_check>
</fix_implementation>

<implementation_testing>
13. **Test the implementation**:
   <testing_requirements>
   - Verify the fix resolves the issue
   - Check for side effects
   - Take "after" screenshot if UI-related
   - Run `phpcbf` and `phpcs` on any modified files
   </testing_requirements>
</implementation_testing>
</implementation>

<git_workflow>
## Git Workflow with Worktrees

<worktree_setup>
14. **Create dedicated worktree for this ticket**:
   ```bash
   # Create a new worktree WITHIN the project directory for Claude Code compatibility
   BRANCH_NAME="fix/freescout-$TICKET_ID-brief-description"
   WORKTREE_DIR="./worktrees/ticket-$TICKET_ID"
   
   # Create worktrees directory if it doesn't exist
   mkdir -p ./worktrees
   
   # Create worktree from master branch within project directory
   git worktree add "$WORKTREE_DIR" -b "$BRANCH_NAME" master
   
   # Switch to the new worktree (staying within allowed directories)
   cd "$WORKTREE_DIR"
   
   echo "✅ Created worktree at: $WORKTREE_DIR"
   echo "✅ Working on branch: $BRANCH_NAME"
   echo "✅ This allows parallel development without affecting your main workspace"
   echo "✅ Worktree is within project directory for Claude Code compatibility"

   # Add worktrees directory to .gitignore if not already present
   if ! grep -q "^worktrees/$" .gitignore 2>/dev/null; then
       echo "worktrees/" >> .gitignore
       echo "✅ Added worktrees/ to .gitignore"
   fi
   ```
   
   <worktree_benefits>
   **Benefits of using worktrees**:
   - Work on multiple tickets simultaneously without branch switching
   - Keep your main workspace clean and unaffected
   - Test changes in isolation
   - Maintain separate development environments
   - Compatible with Claude Code's directory restrictions
   - Organized within project structure (`./worktrees/ticket-ID/`)
   </worktree_benefits>
</worktree_setup>
</git_workflow>

<commit_and_pr>
15. **Commit changes with descriptive message**:
    <commit_requirements>
    - Reference the FreeScout ticket
    - Describe what was fixed
    - Include any breaking changes
    - Include any areas that might need human testing
    - Include any areas that might affect the functionality and require documentation updates
    </commit_requirements>

16. **Create Pull Request**:
    ```bash
    gh pr create --title "Fix: [Brief description] (FreeScout #$TICKET_ID)" \
                 --body "## Summary
    Fixes issue reported in FreeScout ticket #$TICKET_ID: $FREESCOUT_URL/conversation/$TICKET_ID
    
    ## Changes
    - [List changes made]
    
    ## Testing
    - [Describe testing performed]

    ## Areas for Human Testing
    - [List areas that might need human testing]

    ## Areas for Documentation Updates
    - [List areas that might need documentation updates]
    
    ## Customer Context
    [Brief summary of customer's issue]
    
    🤖 Generated with Claude Code"
    ```

17. **Clean up worktree automatically**:
    ```bash
    # Return to main workspace
    cd ../../
    
    # Remove the worktree (frees up the branch for normal Git workflow)
    git worktree remove "./worktrees/ticket-$TICKET_ID"
    
    echo "✅ Worktree cleaned up - you can now use normal Git workflow for PR revisions"
    echo "💡 To make changes: git checkout fix/freescout-$TICKET_ID-brief-description"
    ```
</commit_and_pr>

<freescout_updates>
## FreeScout Updates

<customer_reply_draft>
18. **Draft customer reply**:
    ```bash
    REPLY_BODY="Hi [Customer Name],

Thanks. We were able to reproduce it on our end. We've implemented a fix that [briefly describe what was fixed].

The fix has been submitted for review and will be included in the next plugin update. You'll receive the update through WordPress's automatic update system.

Here's what was changed:
- [List key changes in user-friendly terms]

Please let me know if you have any questions!

Best regards,
Jack"
    ```
</customer_reply_draft>

<api_updates>
19. **Update ticket via API**:
    <api_operations>
    - Add a note (internal thread) with draft reply for Jack to review
    - Set status to "active" 
    - Assign to Jack (user_id: 1)
    </api_operations>
    
    ```bash
    # Add internal note with draft reply for Jack
    # Use jq to properly format JSON with escaped characters
    jq -n --arg text "Draft reply for customer:\n\n$REPLY_BODY" --argjson user 1 \
       '{type: "note", text: $text, user: $user}' | \
    curl -X POST -H "X-FreeScout-API-Key: $FREESCOUT_API_KEY" \
         -H "Content-Type: application/json" \
         "$FREESCOUT_URL/api/conversations/$TICKET_ID/threads" \
         -d @-
    
    # Update ticket status and assignment
    curl -X PUT -H "X-FreeScout-API-Key: $FREESCOUT_API_KEY" \
         -H "Content-Type: application/json" \
         "$FREESCOUT_URL/api/conversations/$TICKET_ID" \
         -d '{
           "status": "active",
           "assignTo": 1,
           "byUser": 1
         }'
    ```
</api_updates>
</freescout_updates>

<completion>
## Completion

<summary>
20. **Provide summary** with:
    <summary_requirements>
    - Link to created PR
    - Brief description of changes
    - Confirmation that FreeScout ticket was updated
    - Any follow-up actions needed
    </summary_requirements>
</summary>



<documentation_updates>
21. **Documentation Update Prompt**:
    <documentation_scope>
    - **Skip for bug fixes** - documentation updates are only needed for:
      - New features or functionality
      - Changes to existing behavior that affect how customers use the plugin
      - Breaking changes (rare - should only happen with explicit user approval)
    </documentation_scope>
    
    - If this is a new feature or behavior change, ask user:
    <documentation_prompt>
    ```
    "Would you like to update the documentation for this feature? (y/n)
    
    The following areas may need documentation updates:
    - [List from PR body's "Areas for Documentation Updates"]
    
    Feature implemented: [Brief description]
    Component affected: [Integration/Module/Core feature name]
    
    Note: Bug fixes typically don't require documentation updates."
    ```
    </documentation_prompt>
    
    - If user responds with 'y' or 'yes':
      - Execute: `/update-docs [Component]: [Feature description] - [Relevant docs URL if known]`
      - Example: `/update-docs MemberPress: Added support for course completion tags - [documentation URL]`
</documentation_updates>
</completion>

<implementation_notes>
## Implementation Notes
<guidelines>
- Consider edge cases and backward compatibility
- Use the project's logging system for debugging (if available)
- Follow the coding standards in CLAUDE.md
- Track documentation needs during implementation for the prompt
- Leverage worktrees for parallel development without disrupting your main workspace
</guidelines>
</implementation_notes>
