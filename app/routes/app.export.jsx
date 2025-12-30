import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  try {
    const { admin } = await authenticate.admin(request);
    const response = await admin.graphql(
      `#graphql
      query getOrders {
        orders(first: 50, sortKey: CREATED_AT, reverse: true) {
          edges {
            node {
              id
              name
              createdAt
              email
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
    if (data.errors) {
      console.error("GraphQL Errors:", data.errors);
      throw new Error("GraphQL Error: " + JSON.stringify(data.errors));
    }

    if (!data.data || !data.data.orders) {
      console.error("Invalid GraphQL Data:", data);
      throw new Error("Invalid data received from Shopify");
    }

    const orders = data.data.orders.edges.map((edge) => edge.node);

    const csvRows = [
      ["Order", "Date", "Email", "Total", "Currency", "Fulfillment"],
      ...orders.map((order) => [
        order.name,
        new Date(order.createdAt).toISOString().split("T")[0],
        order.email || "",
        order.totalPriceSet?.shopMoney?.amount || "0",
        order.totalPriceSet?.shopMoney?.currencyCode || "",
        order.displayFulfillmentStatus,
      ]),
    ];

    const csvString = csvRows.map((row) => row.join(",")).join("\n");

    return new Response(csvString, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="orders-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }
    console.error("Export Loader Error:", error);
    return new Response(JSON.stringify({ error: error.message, stack: error.stack }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
