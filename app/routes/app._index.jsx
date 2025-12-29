import { Page, Layout, Card, Text } from "@shopify/polaris";

export default function Index() {
  return (
    <Page title="Dashboard">
      <Layout>
        <Layout.Section>
          <Card>
            <div style={{ padding: "16px" }}>
              <Text as="p" variant="bodyMd">
                Welcome to Vibita Lite. This is a simplified version of the app for review purposes.
              </Text>
            </div>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
