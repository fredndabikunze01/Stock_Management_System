package com.example.stockmanagement.dto;

import com.example.stockmanagement.model.Product;
import java.math.BigDecimal;
import java.time.Instant;

public record ProductResponse(Long id, String code, String name, String description, BigDecimal price,
                              int quantity, boolean lowStock, Instant createdAt, Instant updatedAt) {
    public static ProductResponse from(Product product, int threshold) {
        return new ProductResponse(product.getId(), product.getCode(), product.getName(),
                product.getDescription(), product.getPrice(), product.getQuantity(),
                product.getQuantity() <= threshold, product.getCreatedAt(), product.getUpdatedAt());
    }
}
