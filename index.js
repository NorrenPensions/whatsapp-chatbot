import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import corsOptions from './config/cors.js';
import healthRoutes from './routes/health.js';
import balanceRoutes from './routes/balance.js';
import clientRoutes from './routes/clientDetails.js';
import officeLocationRoutes from './routes/officeLocation.js';
import statementRoutes from './routes/statement.js';
import embassyLetterRoutes from './routes/embassyLetter.js';
import welcomeLetterRoutes from './routes/welcomeLetter.js';
import fundPricesRoutes from './routes/fundPrices.js';
import benefitStatusRoutes from './routes/benefitStatus.js';

const app = express();

const trustedProxyIps = (process.env.TRUSTED_PROXY_IPS || '')
    .split(',')
    .map(ip => ip.trim())
    .filter(Boolean);

app.set('trust proxy', trustedProxyIps.length ? trustedProxyIps : false);
app.use(cors(corsOptions));
app.use(helmet());
app.use(express.json());

// Routes
app.use('/health', healthRoutes);
app.use('/balance', balanceRoutes);
app.use('/client-details', clientRoutes);
app.use('/office-location', officeLocationRoutes);
app.use('/statement', statementRoutes);
app.use('/embassy-letter', embassyLetterRoutes);
app.use('/welcome-letter', welcomeLetterRoutes);
app.use('/fund-prices', fundPricesRoutes);
app.use('/benefit-status', benefitStatusRoutes);

const port = process.env.PORT || 2200;

app.listen(port, () => console.log(`Server running on port ${port}`));