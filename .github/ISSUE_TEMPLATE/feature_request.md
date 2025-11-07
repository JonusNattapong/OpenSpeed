---
name: Feature Request
description: Suggest a new feature or enhancement
title: "[FEATURE] "
labels: ["enhancement", "triage"]
assignees: []
body:
  - type: markdown
    attributes:
      value: |
        ## Feature Request
        
        Thank you for suggesting a new feature! We appreciate your input in helping make OpenSpeed better.
        
        **Before submitting:**
        - [ ] I have searched for existing feature requests to avoid duplicates
        - [ ] This feature would benefit the OpenSpeed community
        - [ ] I am willing to help implement this feature (optional)

  - type: textarea
    id: problem
    attributes:
      label: Problem/Use Case
      description: What problem are you trying to solve? What's the current limitation?
      placeholder: "Describe the problem this feature would solve"
    validations:
      required: true

  - type: textarea
    id: solution
    attributes:
      label: Proposed Solution
      description: Describe your proposed solution
      placeholder: "How would you like this feature to work?"
    validations:
      required: true

  - type: textarea
    id: alternatives
    attributes:
      label: Alternative Solutions
      description: Have you considered any alternative solutions?
      placeholder: "Describe any alternative approaches you've considered"

  - type: textarea
    id: examples
    attributes:
      label: Code Examples
      description: If applicable, provide code examples of how this feature would be used
      placeholder: |
        ```typescript
        // Example usage
        ```
      render: markdown

  - type: dropdown
    id: priority
    attributes:
      label: Priority
      description: How important is this feature to you?
      options:
        - Nice to have
        - Would be helpful
        - Important for my use case
        - Critical/blocking my work
    validations:
      required: true

  - type: checkboxes
    id: implementation
    attributes:
      label: Implementation Notes
      description: Additional information about implementation
      options:
        - label: I am willing to help implement this feature
        - label: This would be a breaking change
        - label: This requires changes to the core framework
        - label: This is related to a specific plugin
        - label: Documentation updates would be needed

  - type: textarea
    id: additional-context
    attributes:
      label: Additional Context
      description: Add any other context or screenshots about the feature request
      placeholder: "Any additional information that might be helpful"

  - type: checkboxes
    id: checklist
    attributes:
      label: Checklist
      description: Please confirm the following
      options:
        - label: I have searched for existing feature requests
          required: true
        - label: This feature request is not a bug report
          required: true
```
