# GitHub Copilot Integration Plan
## Australian Government Department — Azure DevOps On-Premises

> **Scope**: Incorporate GitHub Copilot for automated code reviews and unit-test
> generation across a mixed .NET / JavaScript / Salesforce / Siebel / FMW codebase
> hosted entirely on Azure DevOps Server (on-premises).  No migration to GitHub
> repositories. IDEs in use: **VS Code**, **JetBrains Rider**, and **IntelliJ IDEA**.

---

## 1. Executive Summary

GitHub Copilot is an IDE-level AI assistant. **It does not require code to be
hosted on GitHub** — it works against any local git checkout, including repos
cloned from Azure DevOps Server.  Two capabilities are relevant here:

| Capability | What it does | ADO on-prem compatible? |
|---|---|---|
| **In-IDE code completion & generation** | Suggests code, generates tests, explains code inside the editor | ✅ Yes — IDE extension only |
| **Copilot for Pull Requests** | Posts AI review comments on PRs | ⚠️ Requires GitHub-hosted repos (not ADO on-prem) |

Because PR-level review requires GitHub, the strategy below uses a **hybrid
approach**: Copilot in the IDE for completion and test generation, and an
ADO-native AI extension (or a self-hosted pipeline step) for automated PR review
comments.

---

## 2. Licensing Requirements

### 2.1 GitHub Copilot
- **GitHub Copilot Business** or **GitHub Copilot Enterprise** licences are
  required per developer seat.
- These are separate from Microsoft 365 Copilot licences — M365 Copilot covers
  Word/Excel/Teams AI features, not IDE code assistance.
- Australian government entities may need to confirm:
  - Data residency: GitHub Enterprise Cloud offers an **EU / Australia** data
    residency option (in preview as of early 2026). Confirm the current status
    with Microsoft/GitHub before procurement.
  - **ISM compliance**: Review the GitHub Copilot privacy statement against the
    Australian Government Information Security Manual (ISM) controls.

### 2.2 Microsoft 365 Copilot
- Existing M365 Copilot licences can be used for:
  - Generating and summarising documentation (Word, Teams).
  - Explaining Azure DevOps work items and test plans.
  - **Not** for in-IDE code generation (that requires GitHub Copilot).

### 2.3 Azure OpenAI Service (self-hosted option)
- For departments with strict data-sovereignty requirements, **Azure OpenAI
  Service** deployed in an Australian Azure region can replace the GitHub
  Copilot cloud service.
- Tools: **Continue.dev** (VS Code / JetBrains extension) or **Tabby** (open
  source, self-hosted) can point to an Azure OpenAI endpoint.
- This avoids any data leaving the department's Azure tenant.

---

## 3. IDE Configuration

### 3.1 VS Code

1. Install the **GitHub Copilot** extension (`github.copilot`).
2. Install the **GitHub Copilot Chat** extension (`github.copilot-chat`).
3. Sign in with a GitHub account that has a Copilot Business seat.
4. The repo does **not** need to be on GitHub — Copilot reads the open file
   context from the local workspace.

Useful commands inside VS Code:
- `Ctrl+I` / `Cmd+I` — Inline Copilot Chat (ask Copilot to explain or modify
  the selected code).
- `/tests` in Copilot Chat — generates unit tests for the selected function.
- `/fix` — suggests a bug fix for highlighted code.
- `/doc` — generates a docstring / XML doc comment.

### 3.2 JetBrains Rider & IntelliJ IDEA

1. Install the **GitHub Copilot** plugin from the JetBrains Marketplace.
2. Sign in with the same GitHub account.
3. Use `Alt+\` to trigger an inline Copilot suggestion.
4. Open **Tools → GitHub Copilot → Copilot Chat** for chat-based test
   generation and code review.

### 3.3 Offline / Air-gapped Environments

If developer workstations cannot reach `copilot.github.com`:

- Configure an **HTTP proxy** that allows `*.github.com` and `*.githubcopilot.com`
  for authenticated developer traffic only.
- Alternatively, deploy **Azure OpenAI + Continue.dev** (see §2.3) so all
  inference traffic stays inside the department's Azure tenant.

---

## 4. Code Review Integration with Azure DevOps On-Premises

Because GitHub Copilot's native PR review requires GitHub-hosted repos, the
following ADO-compatible approaches are recommended in priority order.

### 4.1 Approach A — ADO AI Code Review Extension (Recommended)

**Azure DevOps Marketplace** has several AI-powered code review extensions that
work against ADO Server (on-premises):

| Extension | Notes |
|---|---|
| **PR Pilot** (marketplace) | Posts LLM review comments on ADO PRs |
| **AI Code Review** by Touca | Integrates with Azure OpenAI |
| **Copilot for Azure DevOps** (Microsoft preview) | Rolling out in 2025–2026; check current availability for ADO Server |

Install the chosen extension in the ADO Server instance:
1. Download the `.vsix` from the Marketplace.
2. Upload to the ADO Server extension gallery (`https://<server>/tfs/_gallery`).
3. Enable per-project collection.

### 4.2 Approach B — Pipeline-Driven AI Review (Self-Hosted)

Add a pipeline stage that calls an Azure OpenAI endpoint on every pull request,
then posts comments back to the ADO PR via the ADO REST API.

A minimal `azure-pipelines/copilot-pr-review.yml` template is included in this
repository (see `azure-pipelines/` folder). The pipeline:

1. Detects changed files in the PR.
2. Sends each diff to Azure OpenAI (`gpt-4o` or `gpt-4.1` model).
3. Parses the response and posts line-level comments via the ADO Threads API.

See [azure-pipelines/copilot-pr-review.yml](../azure-pipelines/copilot-pr-review.yml)
for the complete template.

### 4.3 Approach C — Pre-commit / Developer-Side Review

Developers run Copilot Chat locally before pushing:

```
# In VS Code Copilot Chat:
@workspace /review  Please review this diff for security issues, missing error
handling, and test coverage gaps.
```

This is a zero-infrastructure option but relies on developer discipline.

---

## 5. Unit Test Generation

### 5.1 .NET (C#)

**Supported test frameworks**: xUnit, NUnit, MSTest  
**Copilot prompt patterns**:

```csharp
// Place cursor on the method to test, then in Copilot Chat:
// /tests  Generate xUnit tests for the selected method including edge cases.
```

**Automated generation in CI**:

```yaml
# In azure-pipelines/generate-tests.yml
- task: UseDotNet@2
  inputs:
    version: '8.x'

- script: |
    # Use the dotnet-ai-test-generator CLI (community tool wrapping Azure OpenAI)
    dotnet tool install -g AITestGenerator
    ai-test-gen --project src/MyService --output tests/MyService.Tests \
                --framework xunit \
                --azure-openai-endpoint $(AZURE_OPENAI_ENDPOINT) \
                --azure-openai-key $(AZURE_OPENAI_KEY)
  displayName: 'Generate unit tests via Azure OpenAI'
```

### 5.2 JavaScript / TypeScript

**Supported test frameworks**: Jest, Vitest, Mocha  
**Copilot prompt patterns** (Copilot Chat):

```
/tests  Generate Vitest tests for the selected function. Include positive, 
negative, and boundary cases. Mock external dependencies with vi.mock().
```

**Example** — Copilot-generated test stub for a utility function:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { myUtility } from '../utils/myUtility';

describe('myUtility', () => {
  it('returns expected value for valid input', () => {
    expect(myUtility('valid')).toBe('expected');
  });

  it('throws on null input', () => {
    expect(() => myUtility(null)).toThrow('Input cannot be null');
  });
});
```

### 5.3 Salesforce Apex

GitHub Copilot has limited Apex support. Recommended approach:

1. Use the **Salesforce Extension Pack** in VS Code alongside GitHub Copilot.
2. In Copilot Chat, provide context with `@workspace`:

```
@workspace /tests  Generate Apex test class for AccountService.createAccount()
following the Salesforce @isTest convention. Use Test.startTest()/stopTest().
```

3. For CI automation, use **Salesforce CLI** (`sf apex run test`) in ADO
   pipelines after tests are generated and committed.

### 5.4 Oracle FMW / BPEL / SOA Suite

Copilot has minimal awareness of FMW-specific DSLs (BPEL, XSLT, Mediator).
Recommended approach:

1. Use Copilot to generate Java JUnit tests for any custom Java code in FMW
   composites.
2. For BPEL process testing, use **Oracle SOA Test Framework** (EM-based) or
   **SoapUI / APInox** for integration-level testing.
3. Copilot Chat can assist in writing XML test payloads for SOA composites:

```
/generate  Create a sample SOAP request payload for the OrderService WSDL
operation CreateOrder, including all required fields.
```

### 5.5 Siebel

Siebel (eScript / Siebel VB) is not natively supported by Copilot. Options:

1. Export business service logic to JavaScript-compatible pseudocode for Copilot
   to review/test, then manually adapt back.
2. Use Copilot to generate REST API integration tests against Siebel's REST/SOAP
   interface rather than internal eScript tests.
3. Long-term: if migrating Siebel logic to microservices (.NET/Node), generate
   tests as part of the migration.

---

## 6. Security and Compliance (Australian Government)

| Control | Guidance |
|---|---|
| **Data sent to Copilot** | Copilot transmits code snippets to GitHub's servers. For PROTECTED or OFFICIAL:Sensitive data, exclude those files via `.copilotignore` (similar to `.gitignore`). |
| **ISM Controls** | Review controls 0042, 1149, 1517 (software development) and 1211 (AI tools) against the Copilot privacy statement. |
| **Sovereign Cloud** | If data residency is mandatory, use Azure OpenAI (AU East/AU Southeast) with Continue.dev or Tabby instead of GitHub Copilot cloud. |
| **Audit Logging** | GitHub Copilot Business includes audit logs. Export to Azure Monitor / Sentinel via the GitHub Audit Log Streaming feature. |
| **Code Suggestions Privacy** | Disable "Allow GitHub to use my code snippets for product improvements" in Copilot settings for all seats. |
| **Secrets Detection** | Enable Copilot's built-in secrets filter to prevent AI from suggesting code that embeds credentials. |

---

## 7. Rollout Phases

### Phase 1 — IDE Integration (Weeks 1–4)

- [ ] Procure GitHub Copilot Business seats for a pilot group (~5–10 developers).
- [ ] Install and configure Copilot in VS Code, Rider, and IntelliJ IDEA.
- [ ] Establish `.copilotignore` rules for sensitive file paths.
- [ ] Deliver a 1-hour "Copilot for code review and test generation" training session.
- [ ] Define internal guidelines for reviewing AI-generated code before committing.

### Phase 2 — ADO PR Review Automation (Weeks 5–8)

- [ ] Evaluate ADO Marketplace AI review extensions (Approach A above).
- [ ] If no suitable extension, deploy the pipeline-based review template (Approach B).
- [ ] Connect the review pipeline to an Azure OpenAI instance in Australian Azure region.
- [ ] Pilot on two projects: one .NET and one JavaScript project.
- [ ] Measure: review comment acceptance rate, PR cycle time, defect escape rate.

### Phase 3 — Test Generation Automation (Weeks 9–12)

- [ ] Define test coverage targets per project type (.NET, JS, Salesforce).
- [ ] Integrate test generation into the ADO pipeline as an optional PR stage.
- [ ] Generate baseline tests for existing untested code using batch Copilot scripts.
- [ ] Review and commit generated tests (human sign-off required before merge).

### Phase 4 — Governance and Measurement (Ongoing)

- [ ] Enable GitHub Copilot audit log streaming to Azure Monitor.
- [ ] Track: suggestions accepted/rejected, test coverage delta, PR review latency.
- [ ] Review `.copilotignore` quarterly as classification of code changes.
- [ ] Assess whether GitHub Copilot Enterprise (with private fine-tuning) adds value.

---

## 8. `.copilotignore` Template

Place this file in the root of each repository to prevent Copilot from reading
sensitive files:

```gitignore
# .copilotignore — files excluded from GitHub Copilot context

# Secrets and credentials
*.pfx
*.p12
*.key
*.pem
*secrets*
*credentials*
appsettings.Production.json
appsettings.*.json
.env
.env.*

# Government-classified data samples
data/protected/
data/official-sensitive/
Samples/classified/

# Siebel repository exports (may contain PII schema)
siebel-export/
*.sif

# FMW composite deployment plans
*-deploy-plan.xml
```

---

## 9. Frequently Asked Questions

**Q: Does GitHub Copilot require our code to be on GitHub?**  
A: No. The IDE extension works with any local git repository, regardless of
remote origin. Your code stays on Azure DevOps Server.

**Q: Can we use M365 Copilot instead of GitHub Copilot for code generation?**  
A: Not directly. M365 Copilot is designed for productivity apps (Word, Excel,
Teams). GitHub Copilot is the product for IDE-level code assistance. However,
M365 Copilot in Teams can be used to discuss and document code review findings.

**Q: Will Copilot send our source code to Microsoft/GitHub servers?**  
A: Yes, code snippets (not full files) are sent to GitHub's servers as context
for suggestions. Use `.copilotignore` to exclude sensitive paths. For full
sovereignty, use the Azure OpenAI + Continue.dev self-hosted alternative.

**Q: Does Copilot work in Rider and IntelliJ IDEA?**  
A: Yes. Install the "GitHub Copilot" plugin from the JetBrains Marketplace. It
supports Copilot Chat and inline completions in both IDEs.

**Q: What about Salesforce DX and Apex?**  
A: VS Code with the Salesforce Extension Pack + GitHub Copilot extension works
well together. Copilot has reasonable Apex awareness and can generate `@isTest`
classes when given context about the class under test.

---

## 10. References

- [GitHub Copilot for Business — Overview](https://docs.github.com/en/copilot/overview-of-github-copilot/about-github-copilot-for-business)
- [GitHub Copilot in JetBrains IDEs](https://docs.github.com/en/copilot/getting-started-with-github-copilot?tool=jetbrains)
- [Azure DevOps REST API — PR Threads](https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-request-threads)
- [Australian Government ISM](https://www.cyber.gov.au/resources-business-and-government/essential-cyber-security/ism)
- [Continue.dev — self-hosted AI coding assistant](https://continue.dev/)
- [GitHub Copilot Data Privacy](https://docs.github.com/en/site-policy/privacy-policies/github-copilot-privacy-statement)
- [Azure OpenAI Service — AU East](https://learn.microsoft.com/en-us/azure/cognitive-services/openai/overview)
