package com.example.stockmanagement.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "stock_movements")
public class StockMovement {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 8)
    private MovementType type;

    @Column(nullable = false)
    private int quantity;

    @Column(length = 500)
    private String description;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    protected StockMovement() {
    }

    public StockMovement(Product product, MovementType type, int quantity, String description) {
        this.product = product;
        this.type = type;
        this.quantity = quantity;
        this.description = description;
        this.createdAt = Instant.now();
    }

    public Long getId() { return id; }
    public Product getProduct() { return product; }
    public MovementType getType() { return type; }
    public int getQuantity() { return quantity; }
    public String getDescription() { return description; }
    public Instant getCreatedAt() { return createdAt; }
}
