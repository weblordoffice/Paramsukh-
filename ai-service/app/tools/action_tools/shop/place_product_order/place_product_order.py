from typing import Any

from app.models.chat import ChatRequest
from app.services.backend_client import BackendClient
from app.tools.common import AppTool


class PlaceProductOrderTool(AppTool):
    name = "place_product_order"
    description = (
        "Place an order for a specific product. "
        "Always call with user_confirmed=false first to display the checkout summary/preview. "
        "Only call with user_confirmed=true when the user explicitly confirms the order."
    )
    parameters = {
        "type": "object",
        "properties": {
            "product_id": {
                "type": "string",
                "description": "The unique product ID to purchase.",
            },
            "product_name": {
                "type": "string",
                "description": "The name of the product.",
            },
            "product_price": {
                "type": "number",
                "description": "The price of the product per unit.",
            },
            "quantity": {
                "type": "integer",
                "description": "Quantity to buy (defaults to 1).",
            },
            "address_id": {
                "type": "string",
                "description": "Shipping address ID resolved from get_saved_addresses.",
            },
            "payment_method": {
                "type": "string",
                "description": "Payment method: 'cod' or 'razorpay'.",
            },
            "customer_notes": {
                "type": "string",
                "description": "Optional shipping/delivery notes.",
            },
            "user_confirmed": {
                "type": "boolean",
                "description": "Must be set to True only if the user confirmed they want to confirm/place the order.",
            },
        },
        "required": [
            "product_id",
            "product_name",
            "product_price",
            "address_id",
            "payment_method",
            "user_confirmed",
        ],
        "additionalProperties": False,
    }

    def __init__(self) -> None:
        self.backend_client = BackendClient()

    async def execute(self, arguments: dict[str, Any], payload: ChatRequest) -> dict[str, Any]:
        auth_token = payload.backend_auth_token
        if not auth_token:
            return {
                "success": False,
                "summary": "You need to be logged in to place an order.",
                "data": {"error": "auth_required"},
            }

        product_id = str(arguments.get("product_id", "")).strip()
        product_name = str(arguments.get("product_name", "")).strip()
        product_price = float(arguments.get("product_price") or 0.0)
        quantity = int(arguments.get("quantity") or 1)
        address_id = str(arguments.get("address_id", "")).strip()
        payment_method = str(arguments.get("payment_method", "cod")).strip().lower()
        customer_notes = arguments.get("customer_notes")
        user_confirmed = bool(arguments.get("user_confirmed", False))

        # 1. Resolve Delivery Address
        addresses_res = await self.backend_client.get_addresses(auth_token)
        addresses = addresses_res.get("items") or []
        address = next((a for a in addresses if a["id"] == address_id), None)

        if not address:
            return {
                "success": False,
                "summary": "Shipping address not found. Please select a valid address.",
                "data": {"error": "address_not_found"},
            }

        # Calculate breakdown
        subtotal = product_price * quantity
        tax = subtotal * 0.18  # 18% GST as per backend code
        shipping = 0.0  # Free shipping
        total = subtotal + tax + shipping

        # --- STEP 1: Confirmation Required (Render Checkout Summary) ---
        if not user_confirmed:
            summary = (
                f"I have prepared your order for {quantity}x {product_name}. "
                f"Total amount is ₹{total:.2f} (including ₹{tax:.2f} GST). "
                f"Please confirm to place your order."
            )
            return {
                "success": True,
                "summary": summary,
                "data": {
                    "action": "confirmation_required",
                    "product_id": product_id,
                    "product_name": product_name,
                    "quantity": quantity,
                    "price": product_price,
                    "subtotal": subtotal,
                    "tax": tax,
                    "shipping": shipping,
                    "total": total,
                    "address": address,
                    "payment_method": payment_method,
                    "customer_notes": customer_notes,
                    "message": summary,
                },
            }

        # --- STEP 2: Execute Order Placement ---
        try:
            # Clear user cart first
            await self.backend_client.clear_cart(auth_token)

            # Stage target item
            await self.backend_client.add_to_cart(auth_token, product_id, quantity)

            # Create Order
            order_res = await self.backend_client.create_order(
                auth_token=auth_token,
                address_id=address_id,
                payment_method=payment_method,
                customer_notes=customer_notes,
            )

            order_data = order_res.get("data", {}).get("order") or {}
            order_id = order_data.get("_id") or order_data.get("id")

            if payment_method == "razorpay" and order_id:
                # Generate online payment hosted checkout link
                link_res = await self.backend_client.create_payment_link(auth_token, order_id)
                link_data = link_res.get("data") or {}
                payment_url = link_data.get("url")
                payment_link_id = link_data.get("paymentLinkId")

                summary = f"Order #{order_data.get('orderNumber')} created. Please complete payment using the Razorpay link."
                return {
                    "success": True,
                    "summary": summary,
                    "data": {
                        "action": "payment_required",
                        "order_id": order_id,
                        "order_number": order_data.get("orderNumber"),
                        "payment_url": payment_url,
                        "payment_link_id": payment_link_id,
                        "total": total,
                        "message": summary,
                    },
                }

            # Cash on Delivery or successful instant placement
            order_number = order_data.get("orderNumber") or "ORD-NEW"
            summary = f"Order #{order_number} has been successfully placed! You will pay ₹{total:.2f} on delivery."

            return {
                "success": True,
                "summary": summary,
                "data": {
                    "action": "order_confirmed",
                    "order_id": order_id,
                    "order_number": order_number,
                    "total": total,
                    "message": summary,
                },
            }

        except Exception as e:
            return {
                "success": False,
                "summary": f"Failed to place your order: {str(e)}",
                "data": {"error": "placement_failed", "details": str(e)},
            }
