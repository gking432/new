import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const workflow = {
    name: "Northstar Demo - Lead Created to AI Automation",
    nodes: [
      {
        parameters: {
          httpMethod: "POST",
          path: "northstar-lead-created",
          responseMode: "lastNode",
          options: {},
        },
        id: "WebhookTrigger",
        name: "External CRM / Form Webhook",
        type: "n8n-nodes-base.webhook",
        typeVersion: 2,
        position: [260, 300],
      },
      {
        parameters: {
          method: "POST",
          url: "https://YOUR-NORTHSTAR-DEMO-DOMAIN.com/api/demo/webhook/lead-created",
          sendBody: true,
          contentType: "json",
          jsonBody:
            '={{ { "eventType": "lead.created", "source": "n8n", "payload": $json.body || $json } }}',
          options: {},
        },
        id: "SendToNorthstar",
        name: "Send to Northstar AI Automation",
        type: "n8n-nodes-base.httpRequest",
        typeVersion: 4.2,
        position: [560, 300],
      },
      {
        parameters: {
          respondWith: "json",
          responseBody:
            '={{ { "ok": true, "message": "Lead sent to Northstar AI automation layer", "northstarResponse": $json } }}',
          options: {},
        },
        id: "Respond",
        name: "Return AI Workflow Result",
        type: "n8n-nodes-base.respondToWebhook",
        typeVersion: 1.1,
        position: [860, 300],
      },
    ],
    connections: {
      "External CRM / Form Webhook": {
        main: [[{ node: "Send to Northstar AI Automation", type: "main", index: 0 }]],
      },
      "Send to Northstar AI Automation": {
        main: [[{ node: "Return AI Workflow Result", type: "main", index: 0 }]],
      },
    },
    settings: {
      executionOrder: "v1",
    },
    staticData: null,
    pinData: {},
    versionId: "northstar-demo-template",
    meta: {
      templateCredsSetupCompleted: true,
      description:
        "Demo n8n workflow: receive a lead.created webhook and forward it to Northstar's demo AI automation endpoint.",
    },
  };

  return new NextResponse(JSON.stringify(workflow, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": 'attachment; filename="northstar-n8n-lead-created-workflow.json"',
    },
  });
}
