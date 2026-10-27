export enum EmailPattern {
	FirstNameDotLastName = "{firstName}.{lastName}",
	FirstInitialLastName = "{firstInitial}{lastName}",
	FirstNameLastName = "{firstName}{lastName}",
	FirstInitialDotLastName = "{firstInitial}.{lastName}",
	FirstName = "{firstName}",
	FirstNameLastInitial = "{firstName}{lastInitial}",
	FirstNameDotLastInitial = "{firstName}.{lastInitial}",
	FirstNameUnderscoreLastName = "{firstName}_{lastName}",
	FirstNameHyphenLastName = "{firstName}-{lastName}",
	LastNameDotFirstName = "{lastName}.{firstName}",
	LastNameFirstName = "{lastName}{firstName}",
	LastNameFirstInitial = "{lastName}{firstInitial}",
	LastName = "{lastName}",
	FirstInitialLastInitial = "{firstInitial}{lastInitial}",
	Unknown = "unknown",
}

type GenerateEmail = (firstName: string, lastName: string) => string;
export type KnownEmailPattern = Exclude<EmailPattern, EmailPattern.Unknown>;

export const generateEmailLocalPartMap: Record<
	KnownEmailPattern,
	GenerateEmail
> = {
	[EmailPattern.FirstNameDotLastName]: (firstName, lastName) =>
		`${firstName}.${lastName}`,
	[EmailPattern.FirstInitialLastName]: (firstName, lastName) =>
		`${firstName[0]}${lastName}`,
	[EmailPattern.FirstNameLastName]: (firstName, lastName) =>
		`${firstName}${lastName}`,
	[EmailPattern.FirstInitialDotLastName]: (firstName, lastName) =>
		`${firstName[0]}.${lastName}`,
	[EmailPattern.FirstName]: (firstName) => firstName,
	[EmailPattern.FirstNameLastInitial]: (firstName, lastName) =>
		`${firstName}${lastName[0]}`,
	[EmailPattern.FirstNameDotLastInitial]: (firstName, lastName) =>
		`${firstName}.${lastName[0]}`,
	[EmailPattern.FirstNameUnderscoreLastName]: (firstName, lastName) =>
		`${firstName}_${lastName}`,
	[EmailPattern.FirstNameHyphenLastName]: (firstName, lastName) =>
		`${firstName}-${lastName}`,
	[EmailPattern.LastNameDotFirstName]: (firstName, lastName) =>
		`${lastName}.${firstName}`,
	[EmailPattern.LastNameFirstName]: (firstName, lastName) =>
		`${lastName}${firstName}`,
	[EmailPattern.LastNameFirstInitial]: (firstName, lastName) =>
		`${lastName}${firstName[0]}`,
	[EmailPattern.LastName]: (_, lastName) => lastName,
	[EmailPattern.FirstInitialLastInitial]: (firstName, lastName) =>
		`${firstName[0]}${lastName[0]}`,
};

export interface PatternInference {
	email: string;
	pattern: EmailPattern;
}
