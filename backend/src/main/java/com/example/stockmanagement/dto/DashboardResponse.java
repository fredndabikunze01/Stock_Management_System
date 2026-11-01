package com.example.stockmanagement.dto;

import java.util.List;

public record DashboardResponse(long totalProducts, long totalStockQuantity, long lowStockProducts,
                                long outOfStockProducts, List<MovementResponse> recentMovements) {}
