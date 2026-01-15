import { WebClient } from "@slack/web-api";

const slackToken = process.env.SLACK_BOT_TOKEN;

if (!slackToken) {
  console.warn("SLACK_BOT_TOKEN is not set");
}

export const slackClient = new WebClient(slackToken);

