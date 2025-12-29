import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  IndexTable,
  useIndexResourceState,
  BlockStack,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const response = await admin.graphql(
    `#graphql
      query getOrders {
        orders(first: 10, sortKey: CREATED_AT, reverse: true) {
          edges {
            node {
              id
              name
              createdAt
              displayFulfillmentStatus
              totalPriceSet {
                shopMoney {
                  amount
                  currencyCode
                }
              }
            }
          }
        }
      }`
  );

  const data = await response.json();
  return json({
    orders: data.data.orders.edges.map((edge) => edge.node),
  });
};

export default function Index() {
  const { orders } = useLoaderData();
  const resourceName = {
    singular: "order",
    plural: "orders",
  };

  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(orders);

  const rowMarkup = orders.map(
    (
      { id, name, createdAt, displayFulfillmentStatus, totalPriceSet },
      index,
    ) => (
      <IndexTable.Row
        id={id}
        key={id}
        selected={selectedResources.includes(id)}
        position={index}
      >
        <IndexTable.Cell>
          <Text variant="bodyMd" fontWeight="bold" as="span">
            {name}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          {new Date(createdAt).toLocaleDateString()}
        </IndexTable.Cell>
        <IndexTable.Cell>{displayFulfillmentStatus}</IndexTable.Cell>
        <IndexTable.Cell>
          {totalPriceSet?.shopMoney?.amount}{" "}
          {totalPriceSet?.shopMoney?.currencyCode}
        </IndexTable.Cell>
      </IndexTable.Row>
    ),
  );

  return (
    <Page title="Dashboard">
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Recent Orders
              </Text>
              <Text as="p" tone="subdued">
                View the last 10 orders from your store.
              </Text>
              {orders.length > 0 ? (
                <IndexTable
                  resourceName={resourceName}
                  itemCount={orders.length}
                  selectedItemsCount={
                    allResourcesSelected ? "All" : selectedResources.length
                  }
                  onSelectionChange={handleSelectionChange}
                  headings={[
                    { title: "Order" },
                    { title: "Date" },
                    { title: "Status" },
                    { title: "Total" },
                  ]}
                >
                  {rowMarkup}
                </IndexTable>
              ) : (
                <div style={{ padding: "20px", textAlign: "center" }}>
                  <Text as="p" tone="subdued">No orders found.</Text>
                </div>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
