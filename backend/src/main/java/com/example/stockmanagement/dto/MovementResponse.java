package com.example.stockmanagement.dto;

import com.example.stockmanagement.model.MovementType;
import com.example.stockmanagement.model.StockMovement;
import java.time.Instant;

public record MovementResponse(Long id, Long productId, String productCode, String productName,
                               MovementType type, int quantity, String description, Instant createdAt) {
    public static MovementResponse from(StockMovement movement) {
        return new MovementResponse(movement.getId(), movement.getProduct().getId(),
                movement.getProduct().getCode(), movement.getProduct().getName(), movement.getType(),
                movement.getQuantity(), movement.getDescription(), movement.getCreatedAt());
    }
}
