package com.example.stockmanagement.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public record StockRequest(
        @NotNull Long productId,
        @Positive int quantity,
        @Size(max = 500) String description
) {}
