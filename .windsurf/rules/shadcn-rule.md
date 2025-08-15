---
trigger: always_on
description: Use the shadcn ui for the development
---

# Windsurf IDE Rules for UI Development

## 1. UI Components & Styling
- Use **shadcn/ui** for all UI components, blocks, charts, themes, and color palettes.  
  - Reference: [https://ui.shadcn.com/](https://ui.shadcn.com/)  
- Use **Lucide icons** for all iconography.  
  - Reference: [https://lucide.dev/](https://lucide.dev/)  

## 2. Project Structure & Architecture
- Follow **SOLID principles** and established **design patterns** throughout the codebase.  
- Maintain a **clear, modular, and scalable folder structure**.  
  - Example: a `repository/` layer for data access, with separate files grouped by functionality.  
  - Apply similar structure for UI components, services, hooks, utilities, etc.  
- Keep UI, business logic, and data access **cleanly separated**.

## 3. Code Quality & Maintainability
- Ensure components are **reusable**, **self-contained**, and **type-safe**.  
- Follow consistent **naming conventions** for files, folders, and components.  
- Write **clear documentation** for reusable modules and components.  
