package com.example;

import oracle.pg.rdbms.pgql.PgqlConnection;
import oracle.pg.rdbms.pgql.PgqlStatement;
import oracle.pg.rdbms.pgql.PgqlResultSet;
import oracle.pgql.lang.PgqlException;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;

/**
 * ORACLE PGQL PROPERTY GRAPH TEST - KORRIGIERT
 *
 * SETUP:
 * 1. IntelliJ → New Project → Maven
 * 2. Korrekte pom.xml verwenden
 * 3. Maven reload
 * 4. Code ausführen
 */
public class OraclePgqlGraphTest {

    // Ihre Remote-Verbindung
    private static final String URL = "jdbc:oracle:thin:@10.20.110.68:1521/FREEPDB1";
    private static final String USER = "team25s5";
    private static final String PASSWORD = "team25s5.c017";
    private static final String GRAPH_NAME = "worked_at_graph";

    public static void main(String[] args) {
        System.out.println("🚀 Oracle PGQL Graph Test - Schnellstart");

        try {
            // 1. Verbindung testen
            testConnection();

            // 2. Graph erstellen (über PGQL)
            createPgqlGraph();

            // 3. Graph mit PGQL testen
            testPgqlGraph();

        } catch (Exception e) {
            System.err.println("❌ Fehler: " + e.getMessage());
            e.printStackTrace();
        }
    }

    private static void testConnection() throws SQLException {
        System.out.println("\n🔍 Teste JDBC Verbindung...");
        Connection conn = DriverManager.getConnection(URL, USER, PASSWORD);
        System.out.println("✅ JDBC Verbindung erfolgreich!");
        System.out.println("📍 Server: 10.20.110.68:1521/FREEPDB1");
        conn.close();
    }

    private static void createPgqlGraph() throws Exception {
        System.out.println("\n🏗️ Erstelle PGQL Property Graph...");

        // JDBC Connection für PGQL verwenden
        Connection jdbcConn = DriverManager.getConnection(URL, USER, PASSWORD);
        jdbcConn.setAutoCommit(false); // WICHTIG: Auto-Commit für PGQL deaktivieren!

        try {
            PgqlConnection pgqlConn = PgqlConnection.getConnection(jdbcConn);

            // Alten Graph löschen (falls vorhanden)
            try {
                String dropGraphQuery = "DROP PROPERTY GRAPH " + GRAPH_NAME;
                PgqlStatement stmt = pgqlConn.createStatement();
                stmt.execute(dropGraphQuery);
                System.out.println("🗑️ Alter Graph gelöscht");
                // Statements haben keine close() Methode in PGQL API
            } catch (Exception e) {
                System.out.println("ℹ️ Kein alter Graph vorhanden");
            }

            // Neuen PGQL Property Graph erstellen
            String createGraphQuery = String.format("""
                CREATE PROPERTY GRAPH %s
                VERTEX TABLES (
                    persons AS person
                        KEY (id)
                        LABEL person
                        PROPERTIES (id, name, birth_date, death_date, gender, description),
                    workplaces AS workplace
                        KEY (id)
                        LABEL workplace
                        PROPERTIES (id, name, type)
                )
                EDGE TABLES (
                    worked_at_edges AS worked_at
                        KEY (person_id, workplace_id)
                        SOURCE KEY (person_id) REFERENCES person (id)
                        DESTINATION KEY (workplace_id) REFERENCES workplace (id)
                        LABEL worked_at
                        PROPERTIES (end_date)
                )
                OPTIONS ( PG_PGQL )""", GRAPH_NAME);

            PgqlStatement stmt = pgqlConn.createStatement();
            stmt.execute(createGraphQuery);
            System.out.println("✅ PGQL Property Graph erstellt!");

        } finally {
            // Transaction committen und Connection schließen
            jdbcConn.commit();
            jdbcConn.close();
        }
    }

    private static void testPgqlGraph() throws Exception {
        System.out.println("\n📊 Teste PGQL-Queries...");

        Connection jdbcConn = DriverManager.getConnection(URL, USER, PASSWORD);
        jdbcConn.setAutoCommit(false); // WICHTIG: Auto-Commit für PGQL deaktivieren!

        try {
            PgqlConnection pgqlConn = PgqlConnection.getConnection(jdbcConn);

            // Query 1: Alan Turing's Arbeitsplätze (PGQL Syntax)
            System.out.println("\n🔍 Alan Turing's Arbeitsplätze (PGQL):");
            String pgqlQuery1 = String.format("""
                SELECT p.name AS person, w.name AS workplace, w.type
                FROM MATCH (p:person) -[:worked_at]-> (w:workplace) ON %s
                WHERE p.id = 'Q7251'
                """, GRAPH_NAME);

            PgqlStatement stmt1 = pgqlConn.createStatement();
            PgqlResultSet rs1 = stmt1.executeQuery(pgqlQuery1);

            System.out.println("┌─────────────────┬─────────────────────┬─────────────┐");
            System.out.println("│ Person          │ Workplace           │ Type        │");
            System.out.println("├─────────────────┼─────────────────────┼─────────────┤");
            while (rs1.next()) {
                System.out.printf("│ %-15s │ %-19s │ %-11s │%n",
                        rs1.getString("person"),
                        rs1.getString("workplace"),
                        rs1.getString("type"));
            }
            System.out.println("└─────────────────┴─────────────────────┴─────────────┘");
            rs1.close(); // PgqlResultSet hat eine close() Methode

            // Query 2: Alle Verbindungen (Top 5) - PGQL Syntax
            System.out.println("\n🔍 Alle Arbeitsbeziehungen (Top 5) - PGQL:");
            String pgqlQuery2 = String.format("""
                SELECT p.name AS person, w.name AS workplace
                FROM MATCH (p:person) -[:worked_at]-> (w:workplace) ON %s
                LIMIT 5
                """, GRAPH_NAME);

            PgqlStatement stmt2 = pgqlConn.createStatement();
            PgqlResultSet rs2 = stmt2.executeQuery(pgqlQuery2);

            System.out.println("┌─────────────────────┬─────────────────────────┐");
            System.out.println("│ Person              │ Workplace               │");
            System.out.println("├─────────────────────┼─────────────────────────┤");
            while (rs2.next()) {
                System.out.printf("│ %-19s │ %-23s │%n",
                        rs2.getString("person"),
                        rs2.getString("workplace"));
            }
            System.out.println("└─────────────────────┴─────────────────────────┘");
            rs2.close();

            // Query 3: Graph-Statistiken - PGQL Syntax mit korrekter Wert-Extraktion
            System.out.println("\n📈 Graph-Statistiken (PGQL):");
            String pgqlQuery3 = String.format("""
                SELECT 
                    COUNT(DISTINCT p.id) AS anzahl_personen,
                    COUNT(DISTINCT w.id) AS anzahl_arbeitsplaetze,
                    COUNT(*) AS anzahl_verbindungen
                FROM MATCH (p:person) -[:worked_at]-> (w:workplace) ON %s
                """, GRAPH_NAME);

            PgqlStatement stmt3 = pgqlConn.createStatement();
            PgqlResultSet rs3 = stmt3.executeQuery(pgqlQuery3);

            if (rs3.next()) {
                // Verwende getLong() statt getInt() für COUNT-Werte
                System.out.printf("👥 Personen: %d%n", rs3.getLong("anzahl_personen"));
                System.out.printf("🏢 Arbeitsplätze: %d%n", rs3.getLong("anzahl_arbeitsplaetze"));
                System.out.printf("🔗 Verbindungen: %d%n", rs3.getLong("anzahl_verbindungen"));
            }
            rs3.close();

            // Query 4: PGQL-spezifische Features
            System.out.println("\n🔥 PGQL-spezifische Query (Path-Finding):");
            String pgqlQuery4 = String.format("""
                SELECT p1.name AS start_person, p2.name AS end_person
                FROM MATCH (p1:person) -/:worked_at*/-> (:workplace) <-/:worked_at*/- (p2:person) ON %s
                WHERE p1.id = 'Q7251' AND p2.id != 'Q7251'
                LIMIT 3
                """, GRAPH_NAME);

            PgqlStatement stmt4 = pgqlConn.createStatement();
            PgqlResultSet rs4 = stmt4.executeQuery(pgqlQuery4);

            System.out.println("┌─────────────────────┬─────────────────────┐");
            System.out.println("│ Start Person        │ Connected Person    │");
            System.out.println("├─────────────────────┼─────────────────────┤");
            while (rs4.next()) {
                System.out.printf("│ %-19s │ %-19s │%n",
                        rs4.getString("start_person"),
                        rs4.getString("end_person"));
            }
            System.out.println("└─────────────────────┴─────────────────────┘");
            rs4.close();

        } catch (PgqlException e) {
            System.err.println("PGQL Fehler: " + e.getMessage());
            throw e;
        } finally {
            // Transaction committen und Connection schließen
            jdbcConn.commit();
            jdbcConn.close();
        }

        System.out.println("\n✅ PGQL Graph-Test erfolgreich abgeschlossen!");
    }
}
