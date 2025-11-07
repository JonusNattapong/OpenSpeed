---
name: Bug Report
description: Report a bug or unexpected behavior
title: "[BUG] "
labels: ["bug", "triage"]
assignees: []
body:
  - type: markdown
    attributes:
      value: |
        ## Bug Report
        
        Thank you for reporting a bug! Please fill out the information below to help us investigate and fix the issue.
        
        **Before submitting:**
        - [ ] I have searched for existing issues to avoid duplicates
        - [ ] I have tested with the latest version
        - [ ] I have read the [troubleshooting guide](https://jonusnattapong.github.io/OpenSpeed/troubleshooting/)

  - type: input
    id: version
    attributes:
      label: OpenSpeed Version
      description: Which version of OpenSpeed are you using?
      placeholder: "e.g., 1.0.4"
    validations:
      required: true

  - type: dropdown
    id: runtime
    attributes:
      label: Runtime Environment
      description: Which JavaScript runtime are you using?
      options:
        - Node.js
        - Bun
        - Deno
    validations:
      required: true

  - type: input
    id: node-version
    attributes:
      label: Node.js/Bun/Deno Version
      description: Which version of your runtime are you using?
      placeholder: "e.g., Node.js 20.10.0"
    validations:
      required: true

  - type: input
    id: os
    attributes:
      label: Operating System
      description: Which operating system are you using?
      placeholder: "e.g., macOS 14.0, Windows 11, Ubuntu 22.04"
    validations:
      required: true

  - type: textarea
    id: description
    attributes:
      label: Bug Description
      description: Provide a clear and concise description of the bug
      placeholder: "Describe what happened, what you expected to happen, and any error messages"
    validations:
      required: true

  - type: textarea
    id: reproduction
    attributes:
      label: Steps to Reproduce
      description: Provide step-by-step instructions to reproduce the bug
      placeholder: |
        1. Go to '...'
        2. Click on '...'
        3. Scroll down to '...'
        4. See error
      value: |
        1.
        2.
        3.
    validations:
      required: true

  - type: textarea
    id: expected-behavior
    attributes:
      label: Expected Behavior
      description: What should have happened?
      placeholder: "Describe what you expected to happen"
    validations:
      required: true

  - type: textarea
    id: actual-behavior
    attributes:
      label: Actual Behavior
      description: What actually happened?
      placeholder: "Describe what actually happened"
    validations:
      required: true

  - type: textarea
    id: error-logs
    attributes:
      label: Error Logs/Screenshots
      description: Include any error messages, stack traces, or screenshots
      placeholder: |
        ```
        Error message here
        ```
        
        ![Screenshot](url)
      render: markdown

  - type: textarea
    id: additional-context
    attributes:
      label: Additional Context
      description: Add any other context about the problem here
      placeholder: "Any additional information that might be helpful"

  - type: checkboxes
    id: checklist
    attributes:
      label: Checklist
      description: Please confirm the following
      options:
        - label: I have searched for existing issues
          required: true
        - label: I have tested with the latest version
        - label: I have provided a minimal reproduction case
        - label: I am willing to help debug this issue
```
