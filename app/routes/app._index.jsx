import { json } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  IndexTable,
  useIndexResourceState,
  BlockStack,
  Badge,
  Button,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request); /* Wrapper for Order Fetching to handle Permissions */
  let enrichedOrders = [];
  let errorMsg = null;

  try {
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
    if (data.errors) throw new Error(JSON.stringify(data.errors));

    const orders = data.data.orders.edges.map((edge) => edge.node);

    // Fetch processing state from DB
    const states = await db.orderState.findMany({
      where: {
        shop: session.shop,
        orderId: { in: orders.map((o) => o.id) },
      },
    });

    // Merge state
    enrichedOrders = orders.map((order) => {
      const state = states.find((s) => s.orderId === order.id);
      return {
        ...order,
        isProcessed: state ? state.isProcessed : false,
      };
    });

  } catch (err) {
    console.error("Failed to load orders:", err);
    errorMsg = "Failed to load orders. Ensure 'Read Orders' scope is granted in Partner Dashboard > API Access.";
  }

  return json({ orders: enrichedOrders, error: errorMsg });
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const orderId = formData.get("orderId");
  const actionType = formData.get("actionType");

  if (actionType === "toggle") {
    const current = await db.orderState.findUnique({ where: { orderId } });
    const newValue = current ? !current.isProcessed : true;

    await db.orderState.upsert({
      where: { orderId },
      create: {
        orderId,
        shop: session.shop,
        isProcessed: true,
      },
      update: {
        isProcessed: newValue,
      },
    });
  }

  return json({ success: true });
};

export default function Index() {
  const { orders, error } = useLoaderData();
  const fetcher = useFetcher();

  const resourceName = {
    singular: "order",
    plural: "orders",
  };

  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(orders);

  const rowMarkup = orders.map(
    (
      { id, name, createdAt, displayFulfillmentStatus, totalPriceSet, isProcessed },
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
        <IndexTable.Cell>
          {isProcessed ? (
            <Badge tone="success">Processed</Badge>
          ) : (
            <Badge tone="attention">Pending</Badge>
          )}
        </IndexTable.Cell>
        <IndexTable.Cell>
          <fetcher.Form method="post">
            <input type="hidden" name="orderId" value={id} />
            <input type="hidden" name="actionType" value="toggle" />
            <Button submit onClick={(e) => e.stopPropagation()} size="micro">
              {isProcessed ? "Mark Pending" : "Mark Processed"}
            </Button>
          </fetcher.Form>
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
              {error && (
                <div style={{ padding: '10px', background: '#ffe6e6', borderRadius: '4px', color: '#d00' }}>
                  <Text as="p" fontWeight="bold">{error}</Text>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <Text as="h2" variant="headingMd">
                    Order Processing
                  </Text>
                  <Text as="p" tone="subdued">
                    Manage your orders. Click "Mark Processed" to track status.
                  </Text>
                </div>
                <Button onClick={() => window.location.href = "/app/export"} variant="primary">
                  Export CSV
                </Button>
              </div>
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
                    { title: "Fulfillment" },
                    { title: "Total" },
                    { title: "Status" },
                    { title: "Action" },
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
