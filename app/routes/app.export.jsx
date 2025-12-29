import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
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
};
