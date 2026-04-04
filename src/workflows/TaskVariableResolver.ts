export class TaskVariableResolver {
  public static resolveTemplate(template: string, variables: Record<string, unknown>): string {
    return template.replace(/\{\{([^}]+)\}\}/g, (_, path) => {
      const trimmed = path.trim();
      return variables[trimmed] !== undefined ? String(variables[trimmed]) : '';
    });
  }
}
