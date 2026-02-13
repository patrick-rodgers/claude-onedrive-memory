# MCP Server Setup Skill

This skill provides interactive guidance for creating, testing, and deploying MCP servers within Microsoft. It implements the paved path defined for rapid MCP server development.

**North Star**: Enable internal teams to set up a working MCP server in Microsoft Tenant within one hour.

## When to Use This Skill

Invoke this skill when a developer wants to:
- Create a new MCP server to expose product capabilities to GitHub Copilot or Claude Code
- Integrate internal/external APIs with chat experiences
- Set up secure, enterprise-ready MCP servers following Microsoft best practices

## Primary Use Case

A developer wants to access a tool or product from a chat experience powered by GitHub Copilot or Claude Code so that GHCP can invoke product capabilities to answer questions and carry out requested actions.

## Prerequisites Check

Before starting, validate that the user has:
1. An up-to-date Service Tree entry for their internal service
2. An Entra app registration ID (not 1P) or can create one
3. An API with valid permissions
4. Access to the Space tool for admin consent requests

## Interactive Setup Process

### Phase 1: Planning and Prerequisites

**Step 1.1: Identify Remote API**
Ask the user:
- Which remote API do they want to call? (e.g., Microsoft Graph, Azure DevOps, internal service)
- What specific endpoints/actions do they want to expose as MCP tools?
- What data will each tool need to access?

**Step 1.2: Entra App Registration**
Guide the user to:
- Create an Entra app registration for their client scenario
- Define the API permissions/scopes needed for the remote API
- Note the Client ID and Tenant ID

**Step 1.3: Admin Consent Request**
Help the user:
- Use the Space tool to request required admin consent
- For hackathon timelines, use "Temporary consent request"
- Document the permissions being requested and why

### Phase 2: Scaffolding

**Step 2.1: Install Template**
```bash
dotnet new install Microsoft.McpServer.ProjectTemplates
```

**Step 2.2: Create Project**
Ask the user for their server name, then run:
```bash
dotnet new mcpserver -n [ServerName] --transport stdio
cd [ServerName]
```

**Step 2.3: Verify Scaffolding**
```bash
dotnet run
```
Confirm the server starts successfully.

### Phase 3: Implementation

**Step 3.1: Design MCP Tools**
For each API endpoint the user wants to expose:
- Define the tool name (use clear, action-oriented names)
- Identify required input parameters
- Define the minimal response structure
- Plan error handling

**Step 3.2: Implement Authentication**
Help the user set up DefaultAzureCredential pattern:
```csharp
// User must first run: az login
var credential = new DefaultAzureCredential();
var token = await credential.GetTokenAsync(
    new TokenRequestContext(
        new[] { "https://graph.microsoft.com/.default" }  // Adjust scope
    )
);
```

**Step 3.3: Implement Each Tool**
For each tool, help the user:
1. Validate inputs (type checking, required fields, format validation)
2. Acquire access token using DefaultAzureCredential
3. Call the remote endpoint with proper error handling
4. Return a minimal, well-structured response
5. Log relevant information for debugging

**Step 3.4: Security Validation**
Review the implementation for:
- Least-privilege scopes
- Proper input validation
- No hardcoded secrets
- Temporary consent where possible
- Avoiding broad permissions to shared tools

### Phase 4: Testing

**Step 4.1: Local Testing**
Guide the user to:
1. Run the MCP server over STDIO
2. Test each tool with sample inputs
3. Verify authentication works with az CLI
4. Check error handling with invalid inputs

**Step 4.2: Integration Testing**
Help the user:
1. Configure Claude Code or GitHub Copilot to use the MCP server
2. Test each tool through natural language prompts
3. Verify responses are useful and well-formatted
4. Test edge cases and error conditions

### Phase 5: Documentation and Packaging

**Step 5.1: Create README**
Help the user document:
- **Required Permissions**: List all API permissions/scopes
- **Admin Consent**: Link to Space tool request or instructions
- **Environment Variables**: Any configuration needed
- **Sample Prompts**: 2-3 example prompts for each tool
- **Installation**: How to install and run the server
- **Troubleshooting**: Common issues and solutions

**Step 5.2: Package for Distribution**
Offer to help:
- Create a git repository
- Add .gitignore (exclude secrets, tokens)
- Package as a zip file
- Share on internal Microsoft channels

## Tool Patterns and Best Practices

### Minimal Response Pattern
MCP tools should return focused, structured data:
```csharp
// Good: Minimal, structured
return new {
    success = true,
    items = results.Select(r => new {
        id = r.Id,
        name = r.Name,
        status = r.Status
    })
};

// Bad: Dumping entire API response
return apiResponse;  // Too much noise
```

### Error Handling Pattern
```csharp
try {
    // API call
} catch (HttpRequestException ex) {
    return new {
        success = false,
        error = "Failed to reach API",
        details = ex.Message
    };
} catch (UnauthorizedException) {
    return new {
        success = false,
        error = "Authentication failed. Run 'az login' and try again."
    };
}
```

### Input Validation Pattern
```csharp
if (string.IsNullOrWhiteSpace(userId)) {
    return new {
        success = false,
        error = "userId is required"
    };
}

if (!Guid.TryParse(projectId, out _)) {
    return new {
        success = false,
        error = "projectId must be a valid GUID"
    };
}
```

## Security Checklist

Before completing setup, verify:
- [ ] Using DefaultAzureCredential (no hardcoded secrets)
- [ ] Minimum required scopes requested
- [ ] Input validation on all tool parameters
- [ ] Error messages don't leak sensitive info
- [ ] Temporary consent used for hackathon scenarios
- [ ] No broad permissions to shared developer tools
- [ ] Proper logging (without logging secrets)
- [ ] README documents security considerations

## Common Pitfalls to Avoid

1. **Over-permissioned**: Requesting more scopes than needed
2. **No input validation**: Passing user input directly to APIs
3. **Verbose responses**: Returning entire API payloads
4. **Hardcoded secrets**: Embedding tokens or keys
5. **Poor error messages**: Generic "failed" without context
6. **Missing docs**: No sample prompts or setup instructions
7. **No testing**: Not testing with actual chat clients

## Quick Reference Commands

```bash
# Install template
dotnet new install Microsoft.McpServer.ProjectTemplates

# Create server
dotnet new mcpserver -n MyMcpServer --transport stdio

# Run server
cd MyMcpServer
dotnet run

# Login for DefaultAzureCredential
az login

# Test locally
# (Configure Claude Code to use the server, then test with prompts)
```

## Next Steps and Resources

After basic setup, point users to:
- **M365 Copilot Integration**: Separate guide for cloud-hosted, tenant-governed scenarios
- **Remote MCP Server Hosting**: Infrastructure for production deployment
- **MCP Schema Reference**: http://aka.ms/1mcp
- **modelcontextprotocol/schema**: modelcontextprotocol/schema/2025-11-25/schema.json

## Skill Behavior Guidelines

When this skill is invoked:

1. **Be Interactive**: Ask questions at each phase to understand the user's needs
2. **Validate Prerequisites**: Check that prerequisites are met before proceeding
3. **Provide Context**: Explain why each step matters
4. **Generate Code**: Offer to write boilerplate code for common patterns
5. **Test Along the Way**: Suggest testing after each phase
6. **Document As You Go**: Help create documentation incrementally
7. **Security First**: Proactively check for security issues
8. **Time-Box**: Keep the North Star in mind - aim for one hour setup

## Example Invocation Flow

```
User: "I want to create an MCP server for our team's work item tracking API"

Assistant (using this skill):
1. Great! Let's set up an MCP server for your work item tracking API.
2. First, let me verify prerequisites:
   - Do you have a Service Tree entry for your work item service?
   - Do you have an Entra app registration, or do we need to create one?
   - What API endpoints do you want to expose?

[User answers]

3. Perfect. Let's start by identifying the specific tools you want to create...
   [Continues through phases]
```

## Authors

Based on guidance from: Olga Podolyako, David Parks, Patrick Rodgers, Joao Paiva

---

## Non-Goals

- Exposing servers to 3P outside Microsoft trust boundary
- Production deployment guidance (covered in separate documentation)
- M365 Copilot integration (covered in follow-up documentation)
