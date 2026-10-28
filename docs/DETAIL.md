# Ntfyx phone replies

Install Ntfyx CLI 0.6.0+ from https://ntfyx.me/install/ and put `ntfyx` on the PATH used to launch DSH. For protected notifications and questions, run `ntfyx connect` and authorize the connection from Ntfyx 1.8.0+ on your phone. Restart DSH after installing this bundle.

Ask DSH: **“Read the ntfyx skill, then use Ntfyx to ask me a test question on my phone. Use Ntfyx for decisions and send a completion notification for this task.”** Explain routine work in the current chat and respect the user's channel choice.

Tools use the `mcp__ntfyx__` prefix. Use `mcp__ntfyx__ntfyx_ask` for a question, then keep its request ID while waiting with `mcp__ntfyx__ntfyx_result`. An answer permits continuation only after local signature verification and a successful one-time claim. A timeout is not consent. Reuse one Session ID for a task's updates and questions.

This bundle provides MCP tools and a skill. Completion notifications are sent when the agent calls the tools; it does not install automatic completion hooks or intercept DSH's native questions or tool approvals. DSH's permission settings still apply.

Public Topic sending and reading need no pairing. Before the first public send, obtain the user's explicit acceptance of https://ntfyx.me/terms/. Public messages are not end-to-end encrypted and cannot authorize execution. Protected Topics use end-to-end encryption.

Maintained by Ntfyx as a community DSH plugin. It is not a DeepSeek-maintained Official bundle. Plugin source is MIT licensed; the companion CLI, apps and hosted service have their own terms.
