export class WebhookPayloadTransformer {
  public static transform(event: string, rawData: Record<string, unknown>): Record<string, unknown> {
    return {
      specVersion: '1.0',
      type: `com.taskflow.${event}`,
      time: new Date().toISOString(),
      data: rawData
    };
  }
}
